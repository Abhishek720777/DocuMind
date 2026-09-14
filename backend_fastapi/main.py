import os
import io
import uuid
import requests
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import PyPDF2
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
from groq import Groq

# Initialization
app = FastAPI(title="DocuMind RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Models and DB
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="documind_chunks")

# Groq Setup (Need API key in environment or pass it explicitly)
# Provide a dummy key if not set to avoid startup crash, but will fail on query.
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "your-groq-api-key")
groq_client = Groq(api_key=GROQ_API_KEY)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
    is_separator_regex=False,
)

class QueryRequest(BaseModel):
    question: str
    top_k: int = 3

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

    # Chunking
    chunks = text_splitter.split_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not generate chunks from the text.")

    # Embeddings
    embeddings = embedding_model.encode(chunks).tolist()

    # Storage
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
    question = request.question
    top_k = request.top_k

    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Embed query
    query_embedding = embedding_model.encode([question]).tolist()

    # Retrieve
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )

    retrieved_chunks = results['documents'][0] if results['documents'] else []
    retrieved_metadatas = results['metadatas'][0] if results['metadatas'] else []

    if not retrieved_chunks:
        return {"answer": "I don't have enough context to answer that.", "citations": []}

    # Format Context
    context_text = ""
    citations = []
    for i, (chunk, meta) in enumerate(zip(retrieved_chunks, retrieved_metadatas)):
        context_text += f"\n--- Chunk {i+1} (Source: {meta['source']}) ---\n{chunk}\n"
        citations.append({"source": meta['source'], "chunk_index": meta['chunk_index'], "text": chunk})

    # Generation Prompt
    system_prompt = (
        "You are DocuMind, an AI assistant. You must answer the user's question ONLY using the provided context chunks. "
        "Do NOT use external knowledge. If the context does not contain the answer, say 'I cannot find the answer in the provided documents.' "
        "When you provide an answer, you MUST cite the source using the chunk format [Chunk X]."
    )

    user_message = f"Context Information:\n{context_text}\n\nQuestion: {question}\n\nAnswer:"

    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.1,
            max_tokens=1024,
        )
        answer = completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")

    return {
        "answer": answer,
        "citations": citations
    }
