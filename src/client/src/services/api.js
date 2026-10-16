import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

function resolveBaseURL() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return 'http://localhost:3001/api/v1';
  }
  const clean = envUrl.trim().replace(/\/+$/, '');
  if (clean.endsWith('/api/v1')) {
    return clean;
  }
  return `${clean}/api/v1`;
}

const baseURL = resolveBaseURL();

const api = axios.create({
  baseURL,
  withCredentials: true, // Automatically sends HTTP-only refresh token cookie
  timeout: 30000, // 30 second timeout for cold starts
});

// Request interceptor: attach current Bearer token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: auto-refresh on 401 Unauthorized
let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Do NOT attempt token refresh on login, register, or refresh endpoints
    const url = originalRequest.url || '';
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/org/login') ||
      url.includes('/auth/merchant/login') ||
      url.includes('/auth/employee/login') ||
      url.includes('/auth/employee/forgot-password');

    if (error.response?.status !== 401 || originalRequest._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject, config: originalRequest });
      });
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const { data } = await axios.post(
        `${baseURL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newAccessToken = data.accessToken;
      useAuthStore.getState().setAccessToken(newAccessToken);

      // Drain queue
      refreshQueue.forEach(({ resolve, config }) => {
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        resolve(api(config));
      });
      refreshQueue = [];

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().clearAuth();
      refreshQueue.forEach(({ reject }) => reject(refreshError));
      refreshQueue = [];
      if (!window.location.pathname.startsWith('/auth') && window.location.pathname !== '/') {
        window.location.href = '/auth';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
