/**
 * Cold-start session restore, logout idempotence and the refresh single-flight.
 *
 * These three behaviours are load-bearing for an emergency-response app: a
 * responder relaunching the app must be signed in instantly (and stay signed in
 * offline), a backend incident must never log anyone out, and a genuine
 * credential rejection must wipe the session exactly once.
 */
import { AxiosError, type AxiosResponse } from 'axios';

const mockLoginRequest = jest.fn();
const mockSsoExternalTokenRequest = jest.fn();
const mockRefreshTokenRequest = jest.fn();

jest.mock('@/lib/auth/api', () => ({
  loginRequest: (...args: unknown[]) => mockLoginRequest(...args),
  ssoExternalTokenRequest: (...args: unknown[]) => mockSsoExternalTokenRequest(...args),
  refreshTokenRequest: (...args: unknown[]) => mockRefreshTokenRequest(...args),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/storage', () => ({
  zustandStorage: {
    // Nothing persisted: the store rehydrates empty and each test drives
    // restoreSession() with the persisted shape it wants to exercise.
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getItem: jest.fn(() => null),
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  cacheManager: { clear: jest.fn(), remove: jest.fn(), prune: jest.fn() },
}));

jest.mock('@/lib/cache/cache-scope', () => ({
  setCacheScope: jest.fn(),
  clearCacheScope: jest.fn(),
}));

import { registerSessionCleanupHandler } from '@/lib/auth/session-cleanup';

import { resetInFlightRefresh } from '../../../lib/auth/refresh-lock';
import useAuthStore, { restoreSession } from '../store';

/** A JWT-shaped access token whose payload is base64url-encoded, expiring at `expiresAtMs`. */
const makeAccessToken = (expiresAtMs: number): string => {
  const encoded = Buffer.from(JSON.stringify({ sub: 'user-1', exp: Math.floor(expiresAtMs / 1000) }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${encoded}.signature`;
};

const axiosErrorWithStatus = (status: number): AxiosError => {
  const response = { status, statusText: '', data: {}, headers: {}, config: {} as never } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
};

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const profile = { sub: 'user-1', name: 'Unit 1' } as never;

const refreshResponse = {
  access_token: 'new-access-token',
  refresh_token: 'new-refresh-token',
  id_token: 'header.payload.signature',
  expires_in: 3600,
  token_type: 'Bearer',
  expiration_date: '',
};

const sessionCleanup = jest.fn(async () => undefined);

const resetStore = () => {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    refreshTokenExpiresOn: null,
    status: 'idle',
    error: null,
    profile: null,
    userId: null,
    refreshTimeoutId: null,
  });
};

describe('auth store cold start', () => {
  beforeAll(() => {
    registerSessionCleanupHandler(sessionCleanup);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Pin the clock to a whole second: a JWT `exp` claim has second resolution,
    // so a sub-second "now" would make the scheduled refresh delay non-deterministic.
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    resetInFlightRefresh();
    resetStore();
    mockRefreshTokenRequest.mockResolvedValue(refreshResponse);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('restoreSession', () => {
    it('restores a valid access token instantly — no delay, no network on the critical path', async () => {
      const expiresAt = Date.now() + 60 * 60 * 1000;

      restoreSession({
        accessToken: makeAccessToken(expiresAt),
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: String(expiresAt),
        profile,
      });

      // Signed in synchronously: no 2s wait, no refresh round-trip first.
      expect(useAuthStore.getState().status).toBe('signedIn');
      expect(mockRefreshTokenRequest).not.toHaveBeenCalled();

      // Still no network after the old fixed 2s delay would have elapsed.
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockRefreshTokenRequest).not.toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('signedIn');
    });

    it('schedules the proactive refresh one minute before the token expires', async () => {
      const expiresAt = Date.now() + 60 * 60 * 1000;

      restoreSession({
        accessToken: makeAccessToken(expiresAt),
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: String(expiresAt),
        profile,
      });

      // One second before the scheduled refresh: still nothing.
      await jest.advanceTimersByTimeAsync(59 * 60 * 1000 - 1);
      expect(mockRefreshTokenRequest).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(1);
    });

    it('falls back to the persisted expiry when the access token is opaque (not a JWT)', () => {
      restoreSession({
        accessToken: 'opaque-access-token',
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: String(Date.now() + 60 * 60 * 1000),
        profile,
      });

      expect(useAuthStore.getState().status).toBe('signedIn');
      expect(mockRefreshTokenRequest).not.toHaveBeenCalled();
    });

    it('keeps an expired access token signed in and refreshes in the background', async () => {
      restoreSession({
        accessToken: makeAccessToken(Date.now() - 60 * 1000),
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: String(Date.now() - 60 * 1000),
        profile,
      });

      // Optimistically signed in: the 401 interceptor covers the expired token,
      // so the user never sees the login form.
      expect(useAuthStore.getState().status).toBe('signedIn');

      await jest.advanceTimersByTimeAsync(1);

      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().accessToken).toBe('new-access-token');
      expect(useAuthStore.getState().status).toBe('signedIn');
    });

    it('treats a token expiring within the skew window as expired', async () => {
      restoreSession({
        accessToken: makeAccessToken(Date.now() + 10 * 1000),
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: String(Date.now() + 10 * 1000),
        profile,
      });

      expect(useAuthStore.getState().status).toBe('signedIn');
      await jest.advanceTimersByTimeAsync(1);
      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(1);
    });

    it('refreshes immediately (no fixed delay) when only a refresh token was persisted', async () => {
      restoreSession({
        accessToken: null,
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: null,
        profile,
      });

      // Nothing to authorize requests with, so loading is correct here — but the
      // refresh starts right away rather than after an arbitrary 2s wait.
      expect(useAuthStore.getState().status).toBe('loading');
      await jest.advanceTimersByTimeAsync(1);
      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no session was persisted', () => {
      restoreSession({ accessToken: null, refreshToken: null, refreshTokenExpiresOn: null, profile: null });
      restoreSession(undefined);

      expect(useAuthStore.getState().status).toBe('idle');
      expect(mockRefreshTokenRequest).not.toHaveBeenCalled();
    });

    it('never leaves the persisted status as loading when tokens are usable', () => {
      const expiresAt = Date.now() + 60 * 60 * 1000;
      restoreSession({
        accessToken: makeAccessToken(expiresAt),
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: String(expiresAt),
        profile,
      });

      expect(useAuthStore.getState().status).not.toBe('loading');
    });
  });

  describe('offline cold start', () => {
    it('keeps the session (does not bounce to login) when the refresh fails offline', async () => {
      mockRefreshTokenRequest.mockRejectedValue(networkError());

      restoreSession({
        accessToken: makeAccessToken(Date.now() - 60 * 1000),
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresOn: String(Date.now() - 60 * 1000),
        profile,
      });

      expect(useAuthStore.getState().status).toBe('signedIn');

      await jest.advanceTimersByTimeAsync(1);

      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(1);
      // Session preserved, refresh token intact, cleanup never ran.
      expect(useAuthStore.getState().status).toBe('signedIn');
      expect(useAuthStore.getState().refreshToken).toBe('stored-refresh-token');
      expect(sessionCleanup).not.toHaveBeenCalled();
    });

    it('retries the failed refresh in the background after 30s', async () => {
      mockRefreshTokenRequest.mockRejectedValue(networkError());
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', status: 'signedIn' });

      await useAuthStore.getState().refreshAccessToken();
      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(1);

      resetInFlightRefresh();
      await jest.advanceTimersByTimeAsync(30000);

      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(2);
      expect(useAuthStore.getState().status).toBe('signedIn');
    });

    it.each([500, 502, 503, 429])('preserves the session when the token endpoint returns %i', async (status) => {
      mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(status));
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', status: 'signedIn' });

      await useAuthStore.getState().refreshAccessToken();

      expect(useAuthStore.getState().status).toBe('signedIn');
      expect(sessionCleanup).not.toHaveBeenCalled();
    });
  });

  describe('credential rejection', () => {
    it.each([400, 401])('logs out when the token endpoint rejects the refresh token (%i)', async (status) => {
      mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(status));
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', accessToken: 'stale', status: 'signedIn', userId: 'user-1' });

      await useAuthStore.getState().refreshAccessToken();

      expect(useAuthStore.getState().status).toBe('signedOut');
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().refreshToken).toBeNull();
      expect(sessionCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout idempotence', () => {
    it('runs the session cleanup once when concurrent refreshes are all rejected', async () => {
      mockRefreshTokenRequest.mockRejectedValue(axiosErrorWithStatus(401));
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', status: 'signedIn' });

      // Three independent callers (proactive timer + two queued 401s) race.
      await Promise.all([useAuthStore.getState().refreshAccessToken(), useAuthStore.getState().refreshAccessToken(), useAuthStore.getState().refreshAccessToken()]);

      expect(sessionCleanup).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().status).toBe('signedOut');
    });

    it('runs the cleanup once for concurrent direct logout() calls', async () => {
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', status: 'signedIn' });

      await Promise.all([useAuthStore.getState().logout(), useAuthStore.getState().logout()]);

      expect(sessionCleanup).toHaveBeenCalledTimes(1);
    });

    it('still performs a later logout after the guard has settled', async () => {
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', status: 'signedIn' });
      await useAuthStore.getState().logout();
      expect(sessionCleanup).toHaveBeenCalledTimes(1);

      useAuthStore.setState({ refreshToken: 'second-session', status: 'signedIn' });
      await useAuthStore.getState().logout();

      expect(sessionCleanup).toHaveBeenCalledTimes(2);
      expect(useAuthStore.getState().status).toBe('signedOut');
    });
  });

  describe('refresh single-flight', () => {
    it('shares one token request across concurrent callers', async () => {
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', status: 'signedIn' });

      const results = await Promise.all([useAuthStore.getState().refreshAccessToken(), useAuthStore.getState().refreshAccessToken(), useAuthStore.getState().refreshAccessToken()]);

      // Rotation-safe: the refresh token is presented to the server exactly once.
      expect(mockRefreshTokenRequest).toHaveBeenCalledTimes(1);
      expect(results).toEqual([true, true, true]);
      expect(useAuthStore.getState().accessToken).toBe('new-access-token');
      expect(useAuthStore.getState().refreshToken).toBe('new-refresh-token');
    });

    it('records the new access-token expiry so the next cold start can restore instantly', async () => {
      useAuthStore.setState({ refreshToken: 'stored-refresh-token', status: 'signedIn' });

      await useAuthStore.getState().refreshAccessToken();

      const expiresOn = Number(useAuthStore.getState().refreshTokenExpiresOn);
      expect(expiresOn).toBe(Date.now() + refreshResponse.expires_in * 1000);
    });

    it('logs out when there is no refresh token at all', async () => {
      useAuthStore.setState({ refreshToken: null, status: 'signedIn' });

      const result = await useAuthStore.getState().refreshAccessToken();

      expect(result).toBe(false);
      expect(mockRefreshTokenRequest).not.toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('signedOut');
    });
  });
});
