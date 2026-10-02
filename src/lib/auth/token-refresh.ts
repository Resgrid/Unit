import { isAxiosError } from 'axios';

/**
 * Decides whether a failed token-refresh attempt means the stored credentials are
 * known-bad and the user must be logged out.
 *
 * Returns true ONLY when the OAuth2 token endpoint explicitly rejected the refresh
 * token — HTTP 400 (`invalid_grant`) or 401. Every other failure is treated as
 * transient and recoverable:
 *   - no response at all (offline, DNS/TLS failure, request timeout)
 *   - 5xx server errors (the backend is down/degraded, e.g. 502 Bad Gateway)
 *   - 429 rate limiting
 *   - any non-Axios error (e.g. "no refresh token available")
 *
 * Treating those as recoverable (reject + retry on the next request) instead of
 * forcing logout prevents a backend incident from logging out every active user at
 * once — critical for an emergency-response app.
 */
export const isRefreshCredentialRejection = (error: unknown): boolean => {
  if (!isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  return status === 400 || status === 401;
};

/** The HTTP response an error carries, read by shape so any HTTP error (not only an AxiosError instance) is understood. */
const responseOf = (error: unknown): { status?: number; data?: unknown } | undefined => {
  const response = (error as { response?: unknown } | null | undefined)?.response;
  return typeof response === 'object' && response !== null ? (response as { status?: number; data?: unknown }) : undefined;
};

/**
 * A refresh refused because the shared session is locked (passkey workbook section 1.3): `invalid_grant` with
 * `shared_session_locked: true`. Not a sign-out: the tokens stay, the lock screen unlocks the same session, and the
 * refresh runs again afterwards. Checked before isRefreshCredentialRejection, which would otherwise read it as a 400.
 */
export const isSharedSessionLockedRefresh = (error: unknown): boolean => {
  const response = responseOf(error);
  if (response?.status !== 400) {
    return false;
  }
  const body = response.data as { shared_session_locked?: unknown } | undefined;
  return typeof body === 'object' && body !== null && body.shared_session_locked === true;
};

/** What a 401 from the API said about a shared session: locked (unlock it), expired (the shift ran out), or neither. */
export type SharedSession401 = { kind: 'locked'; lockVersion: number | null } | { kind: 'expired' } | null;

export const sharedSession401 = (error: unknown): SharedSession401 => {
  const response = responseOf(error);
  if (response?.status !== 401) {
    return null;
  }
  const body = response.data as { error?: unknown; lock_version?: unknown } | undefined;
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  if (body.error === 'shared_session_locked') {
    return { kind: 'locked', lockVersion: typeof body.lock_version === 'number' ? body.lock_version : null };
  }
  if (body.error === 'shared_session_expired') {
    return { kind: 'expired' };
  }
  return null;
};
