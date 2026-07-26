import { refreshTokenRequest } from './api';
import type { AuthResponse } from './types';

/**
 * Single-flight guard for OAuth2 refresh-token requests.
 *
 * The app has several independent actors that can trigger a refresh at the same
 * time (proactive timer in the auth store, the axios 401 interceptor, SignalR
 * reconnect). With server-side refresh-token rotation, two concurrent refreshes
 * present the same token twice — the second gets `invalid_grant` and the user is
 * force-logged-out. Funnel every refresh through one in-flight promise so all
 * callers share a single request and receive the same rotated token pair.
 */
let inFlightRefresh: Promise<AuthResponse> | null = null;

export const refreshTokenSingleFlight = (refreshToken: string): Promise<AuthResponse> => {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = refreshTokenRequest(refreshToken).finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
};

/** Test hook: drop any pending in-flight reference. */
export const resetInFlightRefresh = (): void => {
  inFlightRefresh = null;
};
