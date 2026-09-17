import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api/users/', // Django Auth
    withCredentials: true,
});

export const ragApi = axios.create({
    baseURL: 'http://localhost:8001/', // FastAPI RAG
    withCredentials: true,
});

// ── Auto-refresh interceptor ────────────────────────────────────────────────
// If any request gets a 401 (access token expired), transparently call the
// refresh endpoint to get a new access cookie, then retry the original request.
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only attempt refresh once per request and only for 401 errors.
        // Skip the refresh endpoint itself to avoid infinite loops.
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url.includes('token/refresh') &&
            !originalRequest.url.includes('login')
        ) {
            if (isRefreshing) {
                // Queue any concurrent requests until the refresh completes.
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => api(originalRequest))
                  .catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post('token/refresh/');
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                // Redirect to login if refresh also fails
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
