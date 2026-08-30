import * as Sentry from '@sentry/react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { cacheManager } from '@/lib/cache/cache-manager';
import { clearCacheScope, setCacheScope } from '@/lib/cache/cache-scope';
import { logger } from '@/lib/logging';

import { loginRequest, ssoExternalTokenRequest } from '../../lib/auth/api';
import { decodeJwtPayload, getJwtExpiryMs } from '../../lib/auth/jwt';
import { refreshTokenSingleFlight } from '../../lib/auth/refresh-lock';
import { runSessionCleanup } from '../../lib/auth/session-cleanup';
import { isRefreshCredentialRejection } from '../../lib/auth/token-refresh';
import type { AuthResponse, AuthState, LoginCredentials, SsoLoginCredentials } from '../../lib/auth/types';
import { type ProfileModel } from '../../lib/auth/types';
import { removeItem, setItem, zustandStorage } from '../../lib/storage';

// Single-flight guard for logout: on a refresh credential rejection every queued
// 401 caller independently reaches logout(), and without a guard the full
// session cleanup (app-data wipe) runs once per caller, concurrently. All
// concurrent callers share one logout run; the guard clears when it settles so
// a later, genuine logout still executes.
let logoutInFlight: Promise<void> | null = null;

// Last SSO exchange that failed with a 2FA challenge, retained IN MEMORY ONLY (module scope,
// never the persisted store) so the OTP prompt can retry the same IdP token with a code.
let pendingSsoMfaCredentials: SsoLoginCredentials | null = null;

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
            const payload = sanitizeJson(decodeJwtPayload(response.authResponse!.id_token!));

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
          } else if (response.mfaRequired) {
            // 2FA challenge: the login screen prompts for the authenticator code and calls
            // login() again with otpCode. Credentials are never retained here.
            set({
              status: 'mfaRequired',
              error: response.invalidOtp ? 'invalid_totp' : null,
            });
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
            const payload = sanitizeJson(decodeJwtPayload(response.authResponse.id_token!));

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
            pendingSsoMfaCredentials = null;
          } else if (response.mfaRequired) {
            // 2FA challenge: retain the exchange in module memory (never the persisted store)
            // so retrySsoWithOtp can replay it with the authenticator code.
            pendingSsoMfaCredentials = credentials;
            logger.info({
              message: 'SSO login requires two-factor verification',
              context: { provider: credentials.provider, invalidOtp: !!response.invalidOtp },
            });
            set({
              status: 'mfaRequired',
              error: response.invalidOtp ? 'invalid_totp' : null,
            });
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

      retrySsoWithOtp: async (otpCode: string) => {
        if (!pendingSsoMfaCredentials) {
          set({ status: 'error', error: 'No pending SSO sign-in to verify' });
          return;
        }

        await get().ssoLogin({ ...pendingSsoMfaCredentials, otpCode });
      },

      logout: async () => {
        // Single-flight: concurrent logout triggers (every 401 caller queued
        // behind a rejected refresh) share one run so the full data wipe never
        // executes twice in parallel.
        if (logoutInFlight) {
          return logoutInFlight;
        }

        logoutInFlight = (async () => {
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
            // Clearing the user id is what drops the API cache scope; leaving it set keeps this user's
            // cache keys live for whoever signs in next on the same device.
            userId: null,
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
        })().finally(() => {
          logoutInFlight = null;
        });

        return logoutInFlight;
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
            // Keep the persisted access-token expiry current so a later cold
            // start can restore the session instantly (see restoreSession).
            refreshTokenExpiresOn: new Date(Date.now() + response.expires_in * 1000).getTime().toString(),
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
            restoreSession(state);
          }, 0);
        };
      },
    }
  )
);

const sanitizeJson = (json: string) => {
  return json.replace(/[\u0000]+/g, '');
};

// Treat an access token expiring within this window as already expired so we
// never restore "signedIn with a valid token" on a token about to lapse.
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

/**
 * Resolve when the stored access token expires (epoch ms). Prefers the token's
 * own `exp` claim; falls back to the persisted expiry timestamp captured at
 * login/refresh time (`refreshTokenExpiresOn` -- historical name, it holds the
 * access-token expiry). Returns null when neither is usable.
 */
const getAccessTokenExpiryMs = (accessToken: string | null | undefined, storedExpiresOn: string | null | undefined): number | null => {
  if (accessToken) {
    const jwtExpiry = getJwtExpiryMs(accessToken);
    if (jwtExpiry !== null) {
      return jwtExpiry;
    }
  }
  if (storedExpiresOn) {
    const parsed = Number(storedExpiresOn);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

type PersistedSession = Pick<AuthState, 'accessToken' | 'refreshToken' | 'refreshTokenExpiresOn' | 'profile'>;

/**
 * Cold-start session restore, invoked once after zustand rehydrates the
 * persisted auth state. Exported for tests.
 *
 * - Valid access token: signedIn immediately (no network, no artificial delay)
 *   with a proactive refresh scheduled in the background before expiry.
 * - Expired/undecodable access token + refresh token: signedIn optimistically --
 *   any API call that hits a 401 rides the interceptor's single-flight refresh --
 *   while an immediate background refresh runs.
 * - Refresh token only: nothing to call the API with, so show 'loading' while
 *   refreshing immediately (no fixed delay).
 * - Transient refresh failures keep the session (refreshAccessToken retries
 *   every 30s); only a definitive credential rejection (400/401 from
 *   /connect/token) logs the user out.
 */
export const restoreSession = (state: PersistedSession | undefined): void => {
  if (!state || !state.refreshToken) {
    // No stored session -- leave status as-is; the tab layout redirects to login.
    return;
  }

  // Clear any existing refresh timer before scheduling a new one
  const existingTimeoutId = useAuthStore.getState().refreshTimeoutId;
  if (existingTimeoutId !== null) {
    clearTimeout(existingTimeoutId);
  }

  if (state.profile?.sub) {
    Sentry.setUser({ id: state.profile.sub, username: state.profile.name });
  }

  // The persist middleware has already merged these into the store; re-applying
  // them keeps this function self-contained, so the scheduled refresh below can
  // never observe a store without the credentials it was told to restore.
  const restoredTokens = {
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    refreshTokenExpiresOn: state.refreshTokenExpiresOn,
  };

  const expiresOn = getAccessTokenExpiryMs(state.accessToken, state.refreshTokenExpiresOn);
  const now = Date.now();

  if (state.accessToken && expiresOn !== null && expiresOn - now > ACCESS_TOKEN_EXPIRY_SKEW_MS) {
    // Access token still valid -- restore instantly and refresh in the
    // background shortly before it expires (1 minute early, like the login path).
    const refreshDelayMs = Math.max(expiresOn - now - 60 * 1000, 1000);
    logger.info({
      message: 'Restored session from storage with valid access token',
      context: { refreshDelayMs },
    });
    const timeoutId = setTimeout(() => useAuthStore.getState().refreshAccessToken(), refreshDelayMs);
    useAuthStore.setState({ ...restoredTokens, status: 'signedIn', error: null, refreshTimeoutId: timeoutId });
    return;
  }

  if (state.accessToken) {
    // Access token expired (or expiry unknown) but a refresh token exists. Stay
    // signed in optimistically: the 401 interceptor refreshes on demand, and an
    // offline cold start keeps the session instead of bouncing to login.
    logger.info({
      message: 'Restored session from storage with expired access token, refreshing in background',
    });
    const timeoutId = setTimeout(() => useAuthStore.getState().refreshAccessToken(), 0);
    useAuthStore.setState({ ...restoredTokens, status: 'signedIn', error: null, refreshTimeoutId: timeoutId });
    return;
  }

  // Refresh token only -- refresh immediately, no artificial delay.
  logger.info({
    message: 'Found refresh token in storage without access token, attempting to restore session',
  });
  const timeoutId = setTimeout(() => useAuthStore.getState().refreshAccessToken(), 0);
  useAuthStore.setState({ ...restoredTokens, status: 'loading', refreshTimeoutId: timeoutId });
};

// Keep the API cache scoped to whoever is signed in. Cache keys embed this identity, so stamping it
// here means a second user on the same device can never be served the first user's cached rosters,
// units or contacts -- and signing out drops the scope so nothing leaks into an anonymous session.
useAuthStore.subscribe((state, previousState) => {
  if (state.userId === previousState.userId) {
    return;
  }

  try {
    // Drop everything the previous identity cached before the new scope goes live, so nothing from
    // the old account can be read back even if a key were to collide.
    cacheManager.clear();
  } catch (error) {
    // Cache hygiene must never be able to break sign-in or sign-out. Stale entries expire on their
    // own, and the scope moved on below, so they are no longer addressable by the new identity.
    logger.warn({
      message: 'Failed to clear the API cache on identity change',
      context: { error },
    });
  }

  // Deliberately outside the clear() attempt: leaving the scope on the previous user is the one
  // failure that actually leaks, since cache keys embed it and the entries we just failed to drop
  // are still there. The new identity has to take over the scope whether or not the clear worked.
  try {
    if (state.userId) {
      setCacheScope({ userId: state.userId });
    } else {
      clearCacheScope();
    }
  } catch (error) {
    logger.warn({
      message: 'Failed to reset the API cache scope on identity change',
      context: { error },
    });
  }
});

export default useAuthStore;
