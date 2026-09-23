import axios from 'axios';

const DJANGO_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://127.0.0.1:8000/api/users/';
const FASTAPI_URL = import.meta.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8001/';

const api = axios.create({
    baseURL: DJANGO_URL,
    withCredentials: true,
});

export const ragApi = axios.create({
    baseURL: FASTAPI_URL,
    withCredentials: true,
});

// ── Attach Bearer token if available in localStorage ─────────────────────────
const attachAuthToken = (axiosInstance) => {
    axiosInstance.interceptors.request.use((config) => {
        const token = localStorage.getItem('documind_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });
};

attachAuthToken(api);
attachAuthToken(ragApi);

// Save access token whenever returned by Django
api.interceptors.response.use((response) => {
    if (response?.data?.access) {
        localStorage.setItem('documind_token', response.data.access);
    }
    return response;
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

const setupInterceptor = (axiosInstance) => {
    axiosInstance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            if (
                error.response?.status === 401 &&
                !originalRequest._retry &&
                !originalRequest.url.includes('token/refresh') &&
                !originalRequest.url.includes('login')
            ) {
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then(() => axiosInstance(originalRequest))
                      .catch(err => Promise.reject(err));
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const refreshRes = await api.post('token/refresh/');
                    if (refreshRes?.data?.access) {
                        localStorage.setItem('documind_token', refreshRes.data.access);
                    }
                    processQueue(null);
                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError);
                    localStorage.removeItem('documind_token');
                    const isPublicPage = ['/', '/login', '/register'].includes(window.location.pathname);
                    if (!isPublicPage && !originalRequest.url.includes('me/')) {
                        window.location.href = '/login';
                    }
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }
            return Promise.reject(error);
        }
    );
};

setupInterceptor(api);
setupInterceptor(ragApi);

export default api;
