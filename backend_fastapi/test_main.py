"""
FastAPI test suite using TestClient (synchronous).
Run with:  pytest test_main.py -v
"""
import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

# Ensure GROQ_API_KEY is set before importing main so it doesn't crash
os.environ.setdefault("GROQ_API_KEY", "test-key-123")

from main import app  # noqa: E402

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self):
        """GET /health should return status ok and include model key."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "model" in data


class TestQueryEndpoint:
    def test_greeting_short_circuits(self):
        """Greetings should return a friendly message without calling Groq."""
        response = client.post("/query", json={
            "question": "hello",
            "top_k": 3,
            "user_id": 1,
        })
        assert response.status_code == 200
        data = response.json()
        assert "DocuMind" in data["answer"]
        assert data["citations"] == []

    def test_empty_question_returns_400(self):
        """An empty question should be rejected with 400."""
        response = client.post("/query", json={
            "question": "   ",
            "top_k": 3,
            "user_id": 1,
        })
        assert response.status_code == 400

    def test_query_no_documents_returns_friendly_message(self):
        """
        When ChromaDB has no documents for the user, the endpoint should
        return a helpful message instead of crashing.
        """
        empty_results = {"documents": [[]], "metadatas": [[]]}
        with patch("main.collection") as mock_collection:
            mock_collection.query.return_value = empty_results
            response = client.post("/query", json={
                "question": "What is dependency injection?",
                "top_k": 3,
                "user_id": 999,
            })
        assert response.status_code == 200
        data = response.json()
        assert data["citations"] == []
        assert "ingested" in data["answer"].lower()


class TestIngestEndpoint:
    def test_ingest_no_file_no_url_returns_400(self):
        """Submitting neither a file nor a URL should return 400."""
        response = client.post("/ingest", data={"user_id": "1"})
        assert response.status_code == 400

    def test_ingest_unsupported_file_type_returns_400(self):
        """Uploading a .docx file should return 400."""
        response = client.post(
            "/ingest",
            data={"user_id": "1"},
            files={"file": ("resume.docx", b"fake content", "application/octet-stream")},
        )
        assert response.status_code == 400
        assert "Unsupported" in response.json()["detail"]
