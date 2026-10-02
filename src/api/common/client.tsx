import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { sharedSession401 } from '@/lib/auth/token-refresh';
import { readProtectedGrantHeaders } from '@/lib/data-protection/grant-provider';
import { logger } from '@/lib/logging';
import { CLIENT_HEADER, RESGRID_CLIENT } from '@/lib/mfa/client-app';
import { getBaseApiUrl } from '@/lib/storage/app';
import useAuthStore from '@/stores/auth/store';
import { markSharedSessionLocked } from '@/stores/shared-session/store';

// Create axios instance with default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: getBaseApiUrl(),
  // Axios defaults to no timeout — a hung request would otherwise hold the
  // single-flight refresh (and every 401-queued request behind it) forever.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    // Which app is calling (passkey plan section 10.4): passkeys, brokered SSO and approvals are bound to it.
    [CLIENT_HEADER]: RESGRID_CLIENT,
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

    // Advanced Data Protection: while the member holds a live grant, every read through this
    // instance carries it, so a protected value comes back decrypted instead of REDACTED.
    //
    // Attached centrally on purpose. The alternative - each screen remembering to add the header -
    // is the failure mode that already shipped twice on the web side, and it fails SILENTLY: the
    // screen looks fine and simply shows placeholders. The grant only ever goes to Resgrid's own
    // API (this instance's baseURL), is short-lived, and is bound to this member, department and
    // policy epoch, so the server is the only thing that can act on it.
    if (config.headers) {
      for (const [name, value] of Object.entries(readProtectedGrantHeaders())) {
        config.headers.set(name, value);
      }
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
    // A shared vehicle session (passkey plan section 10.5): a locked session means "unlock", never "sign out" and never a
    // refresh (a refresh is refused while locked too). A shift that ran out ends the session for good.
    const sharedSession = sharedSession401(error);
    if (sharedSession?.kind === 'locked') {
      markSharedSessionLocked(sharedSession.lockVersion);
      return Promise.reject(error);
    }
    if (sharedSession?.kind === 'expired') {
      void useAuthStore.getState().logout('shift_ended');
      return Promise.reject(error);
    }

    // A 401 carrying a problem `type` is the application refusing this request (a wrong code, a session that ended),
    // not an expired token: the authentication layer answers those with an empty body. Refreshing and replaying would
    // count a wrong code twice, and a refresh refused while locked would replace the refusal the screen needs to show.
    if (error.response?.status === 401 && typeof (error.response.data as { type?: unknown } | undefined)?.type === 'string') {
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
          operation: 'token_refresh',
          trace_id: originalRequest.headers.get('x-trace-id')?.toString(),
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
