
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';
import { clearCredentials, updateAccessToken } from '@/store/authSlice';
import { navigateInApp } from '@/lib/navigation';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function isPublicAuthRequest(url?: string) {
  if (!url) return false;
  return ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'].some((path) =>
    url.includes(path),
  );
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ data: { accessToken: string } }>('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        const accessToken = data.data.accessToken;
        store.dispatch(updateAccessToken(accessToken));
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isPublicAuthRequest(original.url) ||
      original.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const newAccessToken = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      store.dispatch(clearCredentials());
      if (!window.location.pathname.startsWith('/sign-in')) navigateInApp('/sign-in', { replace: true });
      return Promise.reject(refreshError);
    }
  },
);

export default api;
