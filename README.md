# DocuMind

DocuMind is an intelligent full-stack Retrieval-Augmented Generation (RAG) platform. It allows users to upload documents (PDF, TXT) and scrape web pages, indexing their contents into a persistent vector store to enable conversational querying with verifiable, source-backed citations.

---

## Architecture Overview

The system consists of three decoupled components:

1. **Frontend (React + Vite)**:
   - Single Page Application built with React 19, Vite, and React Router.
   - Styled with a bespoke editorial typography design system (Fraunces + Space Grotesk).
   - Manages user sessions via HTTP-only JWT cookies.
   - Provides a Knowledge Studio for document management and an interactive Chat stream with citation cards.

2. **Authentication & User Management Backend (Django + Django REST Framework)**:
   - Handles user registration, authentication, and session tokens.
   - Uses `djangorestframework-simplejwt` to issue secure HTTP-only cookies (`access_token` and `refresh_token`).
   - Tracks document metadata associations per user in a relational database (PostgreSQL in production, SQLite in development).

3. **RAG & Inference Backend (FastAPI + LangChain + ChromaDB + Groq)**:
   - Ingestion pipeline: Text extraction from PDF (PyMuPDF) and Web URLs (Trafilatura), recursive character chunking, and local dense embeddings (`sentence-transformers/all-MiniLM-L6-v2`).
   - Vector Store: ChromaDB with user-level partition filtering.
   - Inference Engine: Groq LLM API with structured citation prompt engineering and thinking token stripping.

---

## Key Features

- **Multi-Source Ingestion**:
  - Direct upload support for PDF and TXT documents.
  - Web scraping for online documentation and articles, with boilerplate removal.
- **Semantic Vector Search**:
  - Dense chunk embeddings indexed in ChromaDB.
  - Multi-tenant data isolation ensuring users only query their own ingested documents.
- **Source-Grounded Answers**:
  - LLM responses are grounded in retrieved context chunks.
  - Inline references with verified citation metadata (source file, passage index, and extracted text).
- **Document-Scoped or Global Chat**:
  - Ability to chat across the entire personal knowledge base or isolate queries to a specific source.
- **Secure Authentication**:
  - HTTP-only cookie JWT architecture preventing XSS-based token theft.
  - Automatic silent token refresh on expiration.

---

## Tech Stack

### Frontend
- React 19
- React Router 7
- Axios
- Vite

### Backend (Auth & Metadata)
- Python 3.11+
- Django 5.x
- Django REST Framework
- Django SimpleJWT
- PostgreSQL / SQLite

### Backend (RAG & Inference)
- FastAPI
- Uvicorn
- ChromaDB
- LangChain Text Splitters
- Sentence-Transformers (`all-MiniLM-L6-v2`)
- PyMuPDF (`fitz`)
- Trafilatura
- Groq Python SDK

---

## Project Structure

```text
DocuMind/
├── backend_django/         # Django configuration and Docker setup
│   ├── Dockerfile
│   └── requirements.txt
├── backend_fastapi/        # FastAPI RAG service
│   ├── main.py             # Ingestion and query endpoints
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # React Vite client application
│   ├── src/
│   │   ├── components/     # Dashboard, Chat, Login, Register
│   │   ├── pages/          # Home landing page
│   │   ├── styles/         # Component stylesheets
│   │   └── api.js          # Configured Axios instances
│   ├── package.json
│   └── vite.config.js
├── users/                  # Django user and document models/views
│   ├── models.py
│   ├── serializers.py
│   ├── urls.py
│   └── views.py
├── docker-compose.yml      # Multi-container orchestration
├── manage.py               # Django CLI management script
├── .env.example            # Environment variables template
└── README.md
```

---

## Getting Started

### Prerequisites

- Git
- Python 3.11 or higher
- Node.js 18 or higher (and npm)
- Docker & Docker Compose (optional, for containerized deployment)
- A Groq API Key (from https://console.groq.com)

---

### Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

```env
# Groq LLM API
GROQ_API_KEY=your_groq_api_key_here

# Django Security
DJANGO_SECRET_KEY=your_secure_django_secret_key_here
DEBUG=True

# Database (Leave empty for SQLite in local dev, or configure for PostgreSQL)
DB_NAME=documind
DB_USER=documind_user
DB_PASSWORD=documind_pass
DB_HOST=localhost
DB_PORT=5432

# CORS & Hosts
CORS_ALLOWED_ORIGINS=http://localhost:5173
ALLOWED_HOSTS=localhost,127.0.0.1
```

---

### Running with Docker Compose (Recommended)

1. Ensure Docker is running.
2. Build and start all services:

```bash
docker compose up --build
```

Services will be accessible at:
- Frontend: `http://localhost:5173` (or run frontend locally with `npm run dev`)
- Django Backend: `http://localhost:8000`
- FastAPI RAG Service: `http://localhost:8001`

---

### Running Locally (Manual Setup)

#### 1. Django Backend

```bash
# Create and activate virtual environment
python -m venv venv_django
# On Windows:
.\venv_django\Scripts\activate
# On Linux/macOS:
source venv_django/bin/activate

# Install dependencies
pip install -r backend_django/requirements.txt

# Run migrations
python manage.py migrate

# Start the Django development server
python manage.py runserver 8000
```

#### 2. FastAPI RAG Backend

```bash
# In a new terminal, create and activate virtual environment
python -m venv venv_fastapi
# On Windows:
.\venv_fastapi\Scripts\activate
# On Linux/macOS:
source venv_fastapi/bin/activate

# Install dependencies
pip install -r backend_fastapi/requirements.txt

# Start the FastAPI server
uvicorn backend_fastapi.main:app --host 0.0.0.0 --port 8001 --reload
```

#### 3. Frontend Client

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Reference

### Django Auth & Documents (`http://localhost:8000/api/`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/register/` | Register a new user (`username`, `email`, `password`) | No |
| POST | `/api/login/` | Authenticate and receive HTTP-only JWT cookies | No |
| POST | `/api/logout/` | Invalidate and clear auth cookies | Yes |
| POST | `/api/token/refresh/` | Refresh expired access token | Via cookie |
| GET | `/api/me/` | Get current authenticated user profile | Yes |
| GET | `/api/documents/` | List all indexed document records for the user | Yes |
| POST | `/api/documents/` | Create a document index tracking record | Yes |

### FastAPI RAG Engine (`http://localhost:8001/`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/health` | Check service health and active LLM model | No |
| POST | `/ingest` | Ingest and vectorize a file (multipart/form-data) or URL | Yes (Cookie) |
| POST | `/query` | Query vector memory with question and optional source filter | Yes (Cookie) |

---

## License

This project is licensed under the MIT License.
