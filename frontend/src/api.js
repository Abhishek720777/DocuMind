import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api/users/', // Django Auth
    withCredentials: true,
});

export const ragApi = axios.create({
    baseURL: 'http://localhost:8001/', // FastAPI RAG
    withCredentials: true,
});

export default api;
