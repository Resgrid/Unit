import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { logger } from '@/lib/logging';
import { getBaseApiUrl } from '@/lib/storage/app';
import useAuthStore from '@/stores/auth/store';

// Create axios instance with default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: getBaseApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track if we're refreshing the token
let isRefreshing = false;
// Store pending requests
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Request interceptor for API calls
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamically update baseURL on every request to support
    // custom server URL changes (e.g. self-hosted environments)
    config.baseURL = getBaseApiUrl();

    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }
    // Handle 401 errors
    if (error.response?.status === 401 && !(originalRequest as InternalAxiosRequestConfig & { _retry?: boolean })._retry) {
      // Mark as retried immediately — also covers requests queued while a
      // refresh is in flight, so a second 401 never triggers another refresh.
      (originalRequest as InternalAxiosRequestConfig & { _retry: boolean })._retry = true;

      if (isRefreshing) {
        // If refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return axiosInstance(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      try {
        if (!useAuthStore.getState().refreshToken) {
          throw new Error('No refresh token available');
        }

        // Delegate to the auth store's single-flight refresh. Concurrent 401s,
        // the proactive refresh timer and SignalR reconnects all share one
        // request, so server-side refresh-token rotation never invalidates a
        // parallel caller. The store also reschedules the proactive timer and
        // performs the full logout + data wipe when the server rejects the
        // refresh token.
        const refreshed = await useAuthStore.getState().refreshAccessToken();
        if (!refreshed) {
          throw new Error('Token refresh failed');
        }

        const access_token = useAuthStore.getState().accessToken;
        if (!access_token) {
          throw new Error('No access token available after refresh');
        }

        // Update Authorization header
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        processQueue(null);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error);

        // The store has already classified the failure: a credential rejection
        // (400/401 from the token endpoint) triggered logout there; anything
        // else is transient and the session is preserved for a later retry.
        logger.warn({
          message: 'Request failed after token refresh attempt',
          context: { error: refreshError },
        });

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Export configured axios instance
export const api = axiosInstance;

// Helper function to create API endpoints
export const createApiEndpoint = (endpoint: string) => {
  return {
    get: <T,>(params?: Record<string, unknown>, signal?: AbortSignal) => api.get<T>(endpoint, { params, signal }),
    post: <T,>(data: Record<string, unknown>, signal?: AbortSignal) => api.post<T>(endpoint, data, { signal }),
    put: <T,>(data: Record<string, unknown>, signal?: AbortSignal) => api.put<T>(endpoint, data, { signal }),
    delete: <T,>(params?: Record<string, unknown>, signal?: AbortSignal) => api.delete<T>(endpoint, { params, signal }),
  };
};
