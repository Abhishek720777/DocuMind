import os
import re
import uuid
import tempfile
import shutil
from pathlib import Path
from typing import Optional

import httpx
import pymupdf
import trafilatura
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel
from fastembed import TextEmbedding
import gc
import json
import sqlite3
import numpy as np

# ── Load .env from the project root ──────────────────────────────────────────
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

# ── Env & Auth Setup ──────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY environment variable is not set.")

DJANGO_SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not DJANGO_SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY environment variable is not set.")

groq_client = Groq(api_key=GROQ_API_KEY)

class LightweightVectorStore:
    """Ultra-compact SQLite + numpy vector store that consumes <15MB RAM instead of ChromaDB's 250MB+."""
    def __init__(self, db_path="./rag_storage.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER,
                    source TEXT,
                    chunk_index INTEGER,
                    document TEXT,
                    embedding BLOB,
                    metadata_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_user_source ON chunks (user_id, source)")
            conn.commit()

    def add(self, documents, embeddings, metadatas, ids):
        with self._get_conn() as conn:
            records = []
            for doc, emb, meta, doc_id in zip(documents, embeddings, metadatas, ids):
                emb_bytes = np.array(emb, dtype=np.float32).tobytes()
                user_id = meta.get("user_id")
                source = meta.get("source", "")
                chunk_index = meta.get("chunk_index", 0)
                records.append((doc_id, user_id, source, chunk_index, doc, emb_bytes, json.dumps(meta)))
            conn.executemany("""
                INSERT OR REPLACE INTO chunks (id, user_id, source, chunk_index, document, embedding, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, records)
            conn.commit()

    def query(self, query_embeddings, n_results=3, where=None):
        user_id = None
        source = None
        if where:
            if "$and" in where:
                for cond in where["$and"]:
                    if "user_id" in cond:
                        user_id = cond["user_id"]
                    if "source" in cond:
                        source = cond["source"]
            elif "user_id" in where:
                user_id = where["user_id"]

        with self._get_conn() as conn:
            query = "SELECT document, embedding, metadata_json FROM chunks WHERE 1=1"
            params = []
            if user_id is not None:
                query += " AND user_id = ?"
                params.append(user_id)
            if source is not None:
                query += " AND source = ?"
                params.append(source)

            rows = conn.execute(query, params).fetchall()

        if not rows:
            return {'documents': [[]], 'metadatas': [[]]}

        docs = []
        embs = []
        metas = []
        for doc, emb_blob, meta_json in rows:
            docs.append(doc)
            embs.append(np.frombuffer(emb_blob, dtype=np.float32))
            metas.append(json.loads(meta_json))

        embs_matrix = np.array(embs)
        q_emb = np.array(query_embeddings[0], dtype=np.float32)

        norm_embs = np.linalg.norm(embs_matrix, axis=1)
        norm_q = np.linalg.norm(q_emb)
        if norm_q > 0:
            norm_embs[norm_embs == 0] = 1e-10
            similarity = np.dot(embs_matrix, q_emb) / (norm_embs * norm_q)
        else:
            similarity = np.zeros(len(docs))

        top_k = min(n_results, len(docs))
        top_indices = np.argsort(similarity)[::-1][:top_k]

        retrieved_docs = [docs[i] for i in top_indices]
        retrieved_metas = [metas[i] for i in top_indices]

        return {'documents': [retrieved_docs], 'metadatas': [retrieved_metas]}

# ── RAG components (initialized lazily on startup to allow port binding first) ─
embedding_model = None
collection = None

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    is_separator_regex=False,
)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="DocuMind RAG API")

GROQ_MODEL: str = "qwen/qwen3.8-27b"

@app.on_event("startup")
async def startup_event():
    global GROQ_MODEL, embedding_model, collection
    GROQ_MODEL = "qwen/qwen3.8-27b"
    # Single-thread ONNX runtime prevents memory explosion
    embedding_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2", threads=1)
    collection = LightweightVectorStore(db_path="./rag_storage.db")
    print("RAG components initialized successfully.")

raw_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
allowed_origins = [o.strip().rstrip("/") for o in raw_origins if o.strip()]
if "https://docu-mind-lemon.vercel.app" not in allowed_origins:
    allowed_origins.append("https://docu-mind-lemon.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "service": "DocuMind FastAPI RAG"}


# ── Auth Dependency ───────────────────────────────────────────────────────────
def get_current_user_id(request: Request) -> int:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated (missing access_token)")
    try:
        payload = jwt.decode(token, DJANGO_SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_access_token(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token

# ── Helpers ───────────────────────────────────────────────────────────────────
def strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks that Qwen3 / reasoning models emit."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

def _extract_text_from_pdf_path(path: str) -> str:
    """Extract text from a PDF file using PyMuPDF."""
    text = ""
    try:
        doc = pymupdf.open(path)
        for page in doc:
            text += page.get_text("text") + "\n"
        doc.close()
    except Exception as e:
        print(f"PyMuPDF error: {e}")
    return text

class QueryRequest(BaseModel):
    question: str
    top_k: int = 3
    source: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL}


@app.post("/ingest")
async def ingest_document(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    user_id: int = Depends(get_current_user_id),
):
    text = ""
    source = ""

    if file:
        source = file.filename

        suffix = Path(file.filename).suffix.lower()
        if suffix not in (".pdf", ".txt"):
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Use PDF or TXT."
            )

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp_path = tmp.name
                shutil.copyfileobj(file.file, tmp)

            if suffix == ".pdf":
                text = _extract_text_from_pdf_path(tmp_path)
            else:
                with open(tmp_path, "r", encoding="utf-8", errors="replace") as f:
                    text = f.read()
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    elif url:
        source = url
        try:
            downloaded = trafilatura.fetch_url(url)
            if not downloaded:
                raise ValueError("Could not download the URL.")
            text = trafilatura.extract(downloaded, include_comments=False, include_tables=True)
            if not text:
                raise ValueError("No article content found at URL.")
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to scrape URL: {str(e)}"
            )
    else:
        raise HTTPException(
            status_code=400, detail="Must provide either a file or a url."
        )

    if not text.strip():
        raise HTTPException(
            status_code=400, detail="No extractable text found."
        )

    chunks = text_splitter.split_text(text)
    if not chunks:
        raise HTTPException(
            status_code=400, detail="Could not generate chunks from the text."
        )

    # Use fastembed with small batches (batch_size=4) to keep memory under 150MB
    embeddings = [e.tolist() for e in embedding_model.embed(chunks, batch_size=4)]
    ids = [str(uuid.uuid4()) for _ in chunks]
    metadatas = [
        {"source": source, "chunk_index": i, "user_id": user_id}
        for i in range(len(chunks))
    ]

    collection.add(
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    gc.collect()

    return {
        "message": "Ingestion successful",
        "source": source,
        "chunks_processed": len(chunks),
    }


@app.post("/query")
async def query_document(
    request: QueryRequest,
    user_id: int = Depends(get_current_user_id)
):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Generate query embedding with fastembed
    query_embeddings = [e.tolist() for e in embedding_model.embed([question])]

    where_clause: dict = {"user_id": user_id}
    if request.source:
        where_clause = {
            "$and": [
                {"user_id": user_id},
                {"source": request.source}
            ]
        }

    results = collection.query(
        query_embeddings=query_embeddings,
        n_results=request.top_k,
        where=where_clause,
    )

    retrieved_chunks = results['documents'][0] if results['documents'] else []
    retrieved_metadatas = results['metadatas'][0] if results['metadatas'] else []

    if not retrieved_chunks:
        return {
            "answer": "No documents have been ingested yet. Go to the Dashboard to upload a file or scrape a URL first.",
            "citations": []
        }

    context_text = ""
    citations = []
    for i, (chunk, meta) in enumerate(zip(retrieved_chunks, retrieved_metadatas)):
        context_text += f"\n--- Chunk {i+1} (Source: {meta['source']}) ---\n{chunk}\n"
        citations.append({
            "source": meta['source'],
            "chunk_index": meta['chunk_index'],
            "text": chunk,
        })

    system_prompt = (
        "/no_think\n"
        "You are DocuMind, a helpful AI assistant. "
        "1. If the user asks a question about the documents, use the provided Context chunks and cite them inline like [Chunk 1].\n"
        "2. If the user says a greeting or makes conversational small talk (e.g., 'hi', 'how are you'), respond naturally and friendly without citing anything.\n"
        "3. If the user asks a factual question NOT found in the Context, politely decline and state that the answer is not in the provided documents.\n"
        "Only output the final answer."
    )

    user_message = f"Context:\n{context_text}\n\nQuestion: {question}\n\nAnswer:"

    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            model=GROQ_MODEL,
            temperature=0.1,
            max_tokens=800,
        )
        raw_answer = completion.choices[0].message.content
        answer = strip_thinking(raw_answer)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"LLM Generation failed: {str(e)}"
        )

    # Filter citations to only those actually cited by the LLM
    used_citations = [
        cit for i, cit in enumerate(citations)
        if f"[Chunk {i+1}]" in answer
    ]

    return {"answer": answer, "citations": used_citations}
