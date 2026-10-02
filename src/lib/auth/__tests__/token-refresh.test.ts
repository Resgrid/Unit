import { describe, expect, it } from '@jest/globals';
import { AxiosError, type AxiosResponse } from 'axios';

import { isRefreshCredentialRejection } from '../token-refresh';

const axiosErrorWithStatus = (status: number): AxiosError => {
  const response = { status, statusText: '', data: {}, headers: {}, config: {} as never } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
};

describe('isRefreshCredentialRejection', () => {
  it('returns true when the token endpoint rejects the refresh token (400 invalid_grant)', () => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(400))).toBe(true);
  });

  it('returns true for a 401 from the token endpoint', () => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(401))).toBe(true);
  });

  it.each([500, 502, 503, 504, 429])('returns false for transient server status %i (preserve session)', (status) => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(status))).toBe(false);
  });

  it('returns false for 403 (ambiguous, not a definitive credential rejection)', () => {
    expect(isRefreshCredentialRejection(axiosErrorWithStatus(403))).toBe(false);
  });

  it('returns false for a network error (no response — offline/DNS/TLS)', () => {
    expect(isRefreshCredentialRejection(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(false);
  });

  it('returns false for a timeout (no response)', () => {
    expect(isRefreshCredentialRejection(new AxiosError('timeout exceeded', 'ECONNABORTED'))).toBe(false);
  });

  it('returns false for a non-Axios error (e.g. "no refresh token available")', () => {
    expect(isRefreshCredentialRejection(new Error('No refresh token available'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isRefreshCredentialRejection(null)).toBe(false);
    expect(isRefreshCredentialRejection(undefined)).toBe(false);
    expect(isRefreshCredentialRejection({ response: { status: 401 } })).toBe(false);
  });
});

describe('shared session refusals', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isSharedSessionLockedRefresh, sharedSession401 } = require('../token-refresh');

  const withBody = (status: number, data: unknown) => ({ response: { status, data } });

  it('reads a refresh refused while the shared session is locked, and nothing else', () => {
    expect(isSharedSessionLockedRefresh(withBody(400, { error: 'invalid_grant', shared_session_locked: true }))).toBe(true);
    expect(isSharedSessionLockedRefresh(withBody(400, { error: 'invalid_grant' }))).toBe(false);
    expect(isSharedSessionLockedRefresh(withBody(400, { shared_session_locked: 'true' }))).toBe(false);
    expect(isSharedSessionLockedRefresh(withBody(401, { shared_session_locked: true }))).toBe(false);
    expect(isSharedSessionLockedRefresh(new Error('offline'))).toBe(false);
    expect(isSharedSessionLockedRefresh(null)).toBe(false);
  });

  it('tells a locked session (with its lock version) from an expired shift, and ignores other 401s', () => {
    expect(sharedSession401(withBody(401, { error: 'shared_session_locked', lock_version: 7 }))).toEqual({ kind: 'locked', lockVersion: 7 });
    expect(sharedSession401(withBody(401, { error: 'shared_session_locked' }))).toEqual({ kind: 'locked', lockVersion: null });
    expect(sharedSession401(withBody(401, { error: 'shared_session_expired' }))).toEqual({ kind: 'expired' });
    expect(sharedSession401(withBody(401, ''))).toBeNull();
    expect(sharedSession401(withBody(401, { type: 'invalid_totp' }))).toBeNull();
    expect(sharedSession401(withBody(403, { error: 'shared_session_locked', lock_version: 7 }))).toBeNull();
    expect(sharedSession401(undefined)).toBeNull();
  });
});
