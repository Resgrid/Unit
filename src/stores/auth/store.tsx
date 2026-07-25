import * as Sentry from '@sentry/react-native';
import base64 from 'react-native-base64';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { logger } from '@/lib/logging';

import { loginRequest, ssoExternalTokenRequest } from '../../lib/auth/api';
import { refreshTokenSingleFlight } from '../../lib/auth/refresh-lock';
import { runSessionCleanup } from '../../lib/auth/session-cleanup';
import { isRefreshCredentialRejection } from '../../lib/auth/token-refresh';
import type { AuthResponse, AuthState, LoginCredentials, SsoLoginCredentials } from '../../lib/auth/types';
import { type ProfileModel } from '../../lib/auth/types';
import { getAuth } from '../../lib/auth/utils';
import { removeItem, setItem, zustandStorage } from '../../lib/storage';

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      refreshTokenExpiresOn: null,
      status: 'idle',
      error: null,
      profile: null,
      userId: null,
      isFirstTime: true,
      refreshTimeoutId: null,
      login: async (credentials: LoginCredentials) => {
        try {
          set({ status: 'loading' });
          const response = await loginRequest(credentials);

          if (response.successful) {
            const payload = sanitizeJson(base64.decode(response.authResponse!.id_token!.split('.')[1]));

            setItem<AuthResponse>('authResponse', response.authResponse!);
            const now = new Date();
            const expiresOn = new Date(now.getTime() + response.authResponse?.expires_in! * 1000).getTime().toString();

            const profileData = JSON.parse(payload) as ProfileModel;

            set({
              accessToken: response.authResponse?.access_token,
              refreshToken: response.authResponse?.refresh_token,
              refreshTokenExpiresOn: expiresOn,
              status: 'signedIn',
              error: null,
              profile: profileData,
              userId: profileData.sub,
            });

            Sentry.setUser({ id: profileData.sub, username: profileData.name });

            // Set up automatic token refresh
            //const decodedToken: { exp: number } = jwtDecode(
            //);
            //const now = new Date();
            //const expiresIn =
            //  response.authResponse?.expires_in! * 1000 - Date.now() - 60000; // Refresh 1 minute before expiry
            //const expiresOn = new Date(
            //  now.getTime() + response.authResponse?.expires_in! * 1000
            //)
            //  .getTime()
            //  .toString();

            // Schedule proactive token refresh before expiry
            // expires_in is in seconds, so convert to milliseconds and refresh 1 minute before expiry
            const refreshDelayMs = Math.max((response.authResponse!.expires_in - 60) * 1000, 60000);
            logger.info({
              message: 'Login successful, scheduling token refresh',
              context: { refreshDelayMs, expiresInSeconds: response.authResponse!.expires_in },
            });
            // Clear any existing refresh timer before scheduling a new one
            const existingTimeoutId = get().refreshTimeoutId;
            if (existingTimeoutId !== null) {
              clearTimeout(existingTimeoutId);
            }
            const timeoutId = setTimeout(() => get().refreshAccessToken(), refreshDelayMs);
            set({ refreshTimeoutId: timeoutId });
          } else {
            set({
              status: 'error',
              error: response.message,
            });
          }
        } catch (error) {
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Login failed',
          });
        }
      },

      ssoLogin: async (credentials: SsoLoginCredentials) => {
        try {
          set({ status: 'loading' });
          const response = await ssoExternalTokenRequest(credentials);

          if (response.successful && response.authResponse) {
            const payload = sanitizeJson(base64.decode(response.authResponse.id_token!.split('.')[1]));

            setItem<AuthResponse>('authResponse', response.authResponse);
            const expiresOn = new Date(Date.now() + response.authResponse.expires_in * 1000).getTime().toString();

            const profileData = JSON.parse(payload) as ProfileModel;

            set({
              accessToken: response.authResponse.access_token,
              refreshToken: response.authResponse.refresh_token,
              refreshTokenExpiresOn: expiresOn,
              status: 'signedIn',
              error: null,
              profile: profileData,
              userId: profileData.sub,
            });

            Sentry.setUser({ id: profileData.sub, username: profileData.name });

            const refreshDelayMs = Math.max((response.authResponse.expires_in - 60) * 1000, 60000);
            logger.info({
              message: 'SSO login successful, scheduling token refresh',
              context: { refreshDelayMs, provider: credentials.provider },
            });

            const existingTimeoutId = get().refreshTimeoutId;
            if (existingTimeoutId !== null) {
              clearTimeout(existingTimeoutId);
            }
            const timeoutId = setTimeout(() => get().refreshAccessToken(), refreshDelayMs);
            set({ refreshTimeoutId: timeoutId });
          } else {
            set({ status: 'error', error: response.message });
          }
        } catch (error) {
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'SSO login failed',
          });
        }
      },

      logout: async () => {
        // Clear any pending refresh timer to prevent stacked timeouts
        const existingTimeoutId = get().refreshTimeoutId;
        if (existingTimeoutId !== null) {
          clearTimeout(existingTimeoutId);
        }
        set({
          accessToken: null,
          refreshToken: null,
          status: 'signedOut',
          error: null,
          profile: null,
          isFirstTime: true,
          refreshTimeoutId: null,
        });
        Sentry.setUser(null);

        // Remove the standalone stored auth response so no valid refresh
        // token is left on the device after logout.
        try {
          await removeItem('authResponse');
        } catch (error) {
          logger.warn({
            message: 'Failed to remove stored auth response on logout',
            context: { error },
          });
        }

        // Route EVERY logout (manual, forced by the 401 interceptor, refresh
        // credential rejection) through the full app-data reset so a different
        // user logging in on the same device never sees the previous user's
        // data — and the previous user's queued offline events never replay
        // under the new account. The reset service registers its handler in
        // the leaf session-cleanup module (avoids a static import cycle).
        try {
          await runSessionCleanup();
        } catch (error) {
          logger.error({
            message: 'Failed to clear app data on logout',
            context: { error },
          });
        }
      },

      refreshAccessToken: async (): Promise<boolean> => {
        try {
          const { refreshToken } = get();
          if (!refreshToken) {
            logger.warn({
              message: 'No refresh token available, logging out user',
            });
            await get().logout();
            return false;
          }

          // Single-flight: concurrent refresh triggers (proactive timer, axios
          // 401 interceptor, SignalR reconnect) share one request so server-side
          // refresh-token rotation never invalidates a parallel caller.
          const response = await refreshTokenSingleFlight(refreshToken);

          // Update the stored auth response for hydration
          setItem<AuthResponse>('authResponse', response);

          set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            status: 'signedIn',
            error: null,
          });

          // Set up next token refresh - refresh 1 minute before expiry
          // expires_in is in seconds, so convert to milliseconds
          const refreshDelayMs = Math.max((response.expires_in - 60) * 1000, 60000); // At least 1 minute
          logger.info({
            message: 'Token refreshed successfully, scheduling next refresh',
            context: { refreshDelayMs, expiresInSeconds: response.expires_in },
          });
          // Clear any existing refresh timer before scheduling a new one
          const existingTimeoutId = get().refreshTimeoutId;
          if (existingTimeoutId !== null) {
            clearTimeout(existingTimeoutId);
          }
          const timeoutId = setTimeout(() => get().refreshAccessToken(), refreshDelayMs);
          set({ refreshTimeoutId: timeoutId });
          return true;
        } catch (error) {
          if (isRefreshCredentialRejection(error)) {
            // The token endpoint explicitly rejected the refresh token
            // (400 invalid_grant / 401) — credentials are known-bad, log out.
            logger.error({
              message: 'Token refresh rejected by server, logging out user',
              context: { error },
            });
            await get().logout();
            return false;
          }

          // Everything else is transient (offline, timeout, 5xx, 429) — keep the
          // session and retry, otherwise a backend incident logs out every
          // active responder at once.
          logger.warn({
            message: 'Token refresh failed transiently, will retry',
            context: { error },
          });
          // Clear any existing refresh timer before scheduling retry
          const existingTimeoutId = get().refreshTimeoutId;
          if (existingTimeoutId !== null) {
            clearTimeout(existingTimeoutId);
          }
          // Retry after 30 seconds for transient errors
          const retryTimeoutId = setTimeout(() => get().refreshAccessToken(), 30000);
          set({ refreshTimeoutId: retryTimeoutId });
          return false;
        }
      },
      hydrate: () => {
        try {
          const authResponse = getAuth();
          if (authResponse !== null && authResponse.refresh_token) {
            // We have stored auth data, try to restore the session
            try {
              const payload = sanitizeJson(base64.decode(authResponse.id_token!.split('.')[1]));
              const profileData = JSON.parse(payload) as ProfileModel;

              set({
                accessToken: authResponse.access_token,
                refreshToken: authResponse.refresh_token,
                status: 'signedIn',
                error: null,
                profile: profileData,
                userId: profileData.sub,
              });

              Sentry.setUser({ id: profileData.sub, username: profileData.name });

              logger.info({
                message: 'Auth state hydrated from storage, token refresh will be scheduled by onRehydrateStorage',
              });

              // Note: Token refresh scheduling is handled by onRehydrateStorage to avoid duplicate refreshes
            } catch (parseError) {
              // Token parsing failed, but we have a refresh token - try to refresh
              logger.warn({
                message: 'Failed to parse stored token, refresh will be attempted by onRehydrateStorage',
                context: { error: parseError instanceof Error ? parseError.message : String(parseError) },
              });

              set({
                refreshToken: authResponse.refresh_token,
                status: 'loading',
              });

              // Note: Token refresh is handled by onRehydrateStorage to avoid duplicate refreshes
            }
          } else {
            logger.info({
              message: 'No stored auth data found, user needs to login',
            });
            get().logout();
          }
        } catch (e) {
          logger.error({
            message: 'Failed to hydrate auth state',
            context: { error: e instanceof Error ? e.message : String(e) },
          });
          // Don't logout here - let the user try to use the app
          // and handle auth errors via the axios interceptor
        }
      },
      isAuthenticated: (): boolean => {
        return get().status === 'signedIn' && get().accessToken !== null;
      },
      setIsOnboarding: () => {
        logger.info({
          message: 'Setting isOnboarding to true',
        });

        set({
          status: 'onboarding',
        });
      },
      //getRights: async () => {
      //  try {
      //    const response = await getCurrentUsersRights();

      //    set({
      //      rights: response.Data,
      //    });
      //  } catch (error) {
      //    // If refresh fails, log out the user
      //  }
      //},
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandStorage),
      // Only persist what is needed to restore a session. Transient fields —
      // status, error, refreshTimeoutId — must never be persisted: an app kill
      // mid-login used to rehydrate `status: 'loading'` with no way out,
      // permanently locking the user behind a spinner.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        refreshTokenExpiresOn: state.refreshTokenExpiresOn,
        profile: state.profile,
        userId: state.userId,
        isFirstTime: state.isFirstTime,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            logger.error({
              message: 'Failed to rehydrate auth storage',
              context: { error: error instanceof Error ? error.message : String(error) },
            });
            return;
          }

          // Defer execution to ensure useAuthStore is fully initialized
          setTimeout(() => {
            // status/error are no longer persisted, so a stored refresh token is
            // the only signal that a session existed — always try to restore it.
            if (state && state.refreshToken) {
              logger.info({
                message: 'Found refresh token in storage, attempting to restore session',
                context: { hasAccessToken: !!state.accessToken },
              });

              // Clear any existing refresh timer before scheduling a new one
              const existingTimeoutId = useAuthStore.getState().refreshTimeoutId;
              if (existingTimeoutId !== null) {
                clearTimeout(existingTimeoutId);
              }
              // Set status to loading while we try to refresh
              useAuthStore.setState({ status: 'loading' });

              const timeoutId = setTimeout(() => {
                useAuthStore.getState().refreshAccessToken();
              }, 2000);
              useAuthStore.setState({ refreshTimeoutId: timeoutId });
            }
          }, 0);
        };
      },
    }
  )
);

const sanitizeJson = (json: string) => {
  return json.replace(/[\u0000]+/g, '');
};

export default useAuthStore;
