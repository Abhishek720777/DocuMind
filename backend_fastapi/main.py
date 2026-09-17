import os
import re
import uuid
import tempfile
import shutil
from pathlib import Path
from typing import Optional

import httpx
import PyPDF2
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import chromadb

# ── Load .env from the project root ──────────────────────────────────────────
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

# ── Groq setup ────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY environment variable is not set.")

groq_client = Groq(api_key=GROQ_API_KEY)

SCRAPER_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/91.0.4472.124 Safari/537.36'
    )
}


async def _pick_chat_model() -> str:
    """Query Groq's /models endpoint and return the best available chat model."""
    WHITELIST = [
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "qwen/qwen3.6-27b",
        "qwen/qwen3.8-27b",
    ]
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            )
            resp.raise_for_status()
            available_ids = {m["id"] for m in resp.json().get("data", [])}
            for candidate in WHITELIST:
                if candidate in available_ids:
                    print(f"[DocuMind] Using Groq model: {candidate}")
                    return candidate
    except Exception as e:
        print(f"[DocuMind] WARNING: Could not resolve Groq model list ({e}). Defaulting.")
    return "openai/gpt-oss-20b"


# ── RAG components ────────────────────────────────────────────────────────────
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="documind_chunks")

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
    is_separator_regex=False,
)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="DocuMind RAG API")

GROQ_MODEL: str = "openai/gpt-oss-20b"  # resolved on startup


@app.on_event("startup")
async def startup_event():
    global GROQ_MODEL
    GROQ_MODEL = await _pick_chat_model()


app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ALLOWED_ORIGINS", "http://localhost:5173"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ───────────────────────────────────────────────────────────────────
def strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks that Qwen3 / reasoning models emit."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


GREETING_PATTERN = re.compile(
    r"^\s*(hi|hello|hey|howdy|yo|sup|good\s*(morning|afternoon|evening|day)|what'?s up|greetings)\W*$",
    re.IGNORECASE,
)


def is_greeting(text: str) -> bool:
    return bool(GREETING_PATTERN.match(text))


def _extract_text_from_pdf_path(path: str) -> str:
    """Extract text from a PDF file on disk (avoids loading entire file into RAM)."""
    text = ""
    with open(path, "rb") as f:
        pdf_reader = PyPDF2.PdfReader(f)
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


class QueryRequest(BaseModel):
    question: str
    top_k: int = 3
    user_id: int
    source: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL}


@app.post("/ingest")
async def ingest_document(
    user_id: int = Form(...),
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None)
):
    text = ""
    source = ""

    if file:
        source = file.filename

        # Stream the upload to a temp file to avoid loading it entirely into RAM
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
            async with httpx.AsyncClient(
                headers=SCRAPER_HEADERS, timeout=10, follow_redirects=True
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
            soup = BeautifulSoup(response.content, "html.parser")
            text = soup.get_text(separator="\n", strip=True)
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to scrape URL (HTTP {e.response.status_code}): {url}"
            )
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

    embeddings = embedding_model.encode(chunks).tolist()
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

    return {
        "message": "Ingestion successful",
        "source": source,
        "chunks_processed": len(chunks),
    }


@app.post("/query")
async def query_document(request: QueryRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Short-circuit for greetings — no point running RAG on "hi"
    if is_greeting(question):
        return {
            "answer": "Hello! I'm DocuMind. Upload a document or scrape a URL from the Dashboard, then ask me anything about it.",
            "citations": []
        }

    query_embedding = embedding_model.encode([question]).tolist()

    where_clause: dict = {"user_id": request.user_id}
    if request.source:
        where_clause = {
            "$and": [
                {"user_id": request.user_id},
                {"source": request.source}
            ]
        }

    results = collection.query(
        query_embeddings=query_embedding,
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
        "You will be provided with Context chunks. "
        "1. If the user asks a question about the documents, use the Context and cite chunks inline like [Chunk 1].\n"
        "2. If the user says a greeting or makes conversational small talk (e.g., 'okay', 'what are you', 'thanks'), respond naturally and friendly without citing anything.\n"
        "3. If the user asks a factual question NOT found in the Context, politely decline and state that the answer is not in the provided documents. Do NOT use your general knowledge to answer.\n"
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
