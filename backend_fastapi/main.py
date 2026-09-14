import os
import io
import re
import uuid
import requests
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import PyPDF2
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb
from groq import Groq

# ── Groq setup ────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY environment variable is not set.")

groq_client = Groq(api_key=GROQ_API_KEY)

def _pick_chat_model() -> str:
    """Query Groq's /models endpoint and return the best available chat model."""
    WHITELIST = [
        "qwen/qwen3.6-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
    ]
    try:
        resp = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            timeout=8,
        )
        resp.raise_for_status()
        available_ids = {m["id"] for m in resp.json().get("data", [])}
        for candidate in WHITELIST:
            if candidate in available_ids:
                print(f"[DocuMind] Using Groq model: {candidate}")
                return candidate
    except Exception as e:
        print(f"[DocuMind] WARNING: Could not resolve Groq model list ({e}). Defaulting.")
    return "qwen/qwen3.6-27b"

GROQ_MODEL = _pick_chat_model()

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


class QueryRequest(BaseModel):
    question: str
    top_k: int = 3


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL}


@app.post("/ingest")
async def ingest_document(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None)
):
    text = ""
    source = ""

    if file:
        source = file.filename
        content = await file.read()
        if file.filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        elif file.filename.endswith(".txt"):
            text = content.decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF or TXT.")
    elif url:
        source = url
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, "html.parser")
            text = soup.get_text(separator="\n", strip=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to scrape URL: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Must provide either a file or a url.")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No extractable text found.")

    chunks = text_splitter.split_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not generate chunks from the text.")

    embeddings = embedding_model.encode(chunks).tolist()
    ids = [str(uuid.uuid4()) for _ in range(len(chunks))]
    metadatas = [{"source": source, "chunk_index": i} for i in range(len(chunks))]

    collection.add(
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids
    )

    return {"message": "Ingestion successful", "source": source, "chunks_processed": len(chunks)}


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

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=request.top_k
    )

    retrieved_chunks = results['documents'][0] if results['documents'] else []
    retrieved_metadatas = results['metadatas'][0] if results['metadatas'] else []

    if not retrieved_chunks:
        return {"answer": "No documents have been ingested yet. Go to the Dashboard to upload a file or scrape a URL first.", "citations": []}

    context_text = ""
    citations = []
    for i, (chunk, meta) in enumerate(zip(retrieved_chunks, retrieved_metadatas)):
        context_text += f"\n--- Chunk {i+1} (Source: {meta['source']}) ---\n{chunk}\n"
        citations.append({"source": meta['source'], "chunk_index": meta['chunk_index'], "text": chunk})

    system_prompt = (
        "You are DocuMind, a helpful AI assistant. "
        "Answer the user's question using ONLY the provided context chunks. "
        "Do not use any external knowledge. "
        "If the context does not contain a clear answer, say exactly: 'I cannot find the answer in the provided documents.' "
        "Always cite which chunk(s) you used with [Chunk X] inline in your answer. "
        "Be concise and direct. Do not output your reasoning or thought process — only the final answer."
    )

    user_message = f"Context:\n{context_text}\n\nQuestion: {question}\n\nAnswer:"

    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model=GROQ_MODEL,
            temperature=0.1,
            max_tokens=800,
        )
        raw_answer = completion.choices[0].message.content
        # Strip <think>...</think> blocks emitted by reasoning models like Qwen3
        answer = strip_thinking(raw_answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")

    return {
        "answer": answer,
        "citations": citations
    }
