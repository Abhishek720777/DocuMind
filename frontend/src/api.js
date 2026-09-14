import axios from 'axios';

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/users/', // Django Auth
    withCredentials: true,
});

export const ragApi = axios.create({
    baseURL: 'http://127.0.0.1:8001/', // FastAPI RAG
    withCredentials: true,
});

export default api;
