/**
 * The auth store on a login transaction (passkey plan section 7.5) and on a shared vehicle session (section 10.5): the
 * pending sign-in is never persisted, the completion grant signs in like the password path, a refresh refused while the
 * shared session is locked keeps the tokens, and a sign-out drops every sign-in secret and the shared state.
 */
const mockLoginRequest = jest.fn();
const mockRefreshTokenRequest = jest.fn();
const mockCompletionGrantRequest = jest.fn();
const mockCompleteTotp = jest.fn();

jest.mock('@/lib/auth/api', () => ({
  loginRequest: (...args: unknown[]) => mockLoginRequest(...args),
  ssoExternalTokenRequest: jest.fn(),
  refreshTokenRequest: (...args: unknown[]) => mockRefreshTokenRequest(...args),
  completionGrantRequest: (...args: unknown[]) => mockCompletionGrantRequest(...args),
}));
jest.mock('@/lib/mfa/transaction-api', () => ({
  ...jest.requireActual('@/lib/mfa/transaction-api'),
  completeTotp: (...args: unknown[]) => mockCompleteTotp(...args),
}));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/storage', () => ({
  zustandStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getItem: jest.fn(() => null),
}));
let mockSharedInstallation = false;
jest.mock('@/lib/mfa/shared-installation', () => ({
  ...jest.requireActual('@/lib/mfa/shared-installation'),
  isSharedInstallation: () => mockSharedInstallation,
}));
jest.mock('@/lib/cache/cache-manager', () => ({ cacheManager: { clear: jest.fn(), remove: jest.fn(), prune: jest.fn() } }));
jest.mock('@/lib/cache/cache-scope', () => ({ setCacheScope: jest.fn(), clearCacheScope: jest.fn() }));

import { registerSessionCleanupHandler } from '@/lib/auth/session-cleanup';
import { hasLoginTransaction } from '@/stores/auth/login-mfa';
import { applySharedSessionStatus, useSharedSessionStore } from '@/stores/shared-session/store';

import { resetInFlightRefresh } from '../../../lib/auth/refresh-lock';
import useAuthStore, { restoreSession } from '../store';

const idToken = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64').replace(/=+$/, '')}.s`;

const tokens = {
  access_token: 'access',
  refresh_token: 'refresh',
  id_token: idToken({ sub: 'user-9', name: 'Pat' }),
  expires_in: 3600,
  token_type: 'Bearer',
  expiration_date: '',
};

const challenge = { kind: 'verify' as const, methods: ['totp' as const], enrolled: ['totp' as const], preferred: 'totp' as const, expiresAt: null, source: 'password' as const };

describe('auth store: login transaction and shared sessions', () => {
  beforeAll(() => registerSessionCleanupHandler(async () => undefined));

  beforeEach(() => {
    jest.clearAllMocks();
    resetInFlightRefresh();
    useAuthStore.setState({ accessToken: null, refreshToken: null, status: 'signedOut', error: null, profile: null, userId: null, refreshTimeoutId: null, mfaChallenge: null, pendingRecoveryCodes: null });
    useSharedSessionStore.setState({ shared: false, locked: false, lockVersion: null });
  });

  afterEach(() => {
    const timer = useAuthStore.getState().refreshTimeoutId;
    if (timer) {
      clearTimeout(timer);
    }
  });

  it('holds a login transaction in memory and shows only the challenge', async () => {
    mockLoginRequest.mockResolvedValue({ successful: false, message: '', authResponse: null, mfaRequired: true, mfaTransaction: { secret: 'txn-secret', challenge } });

    await useAuthStore.getState().login({ username: 'pat', password: 'pw' });

    expect(useAuthStore.getState()).toMatchObject({ status: 'mfaRequired', mfaChallenge: challenge, error: null });
    expect(hasLoginTransaction()).toBe(true);
    expect(JSON.stringify(useAuthStore.getState())).not.toContain('txn-secret');
  });

  it('finishes the sign-in with the completion grant, like the password path', async () => {
    mockLoginRequest.mockResolvedValue({ successful: false, message: '', authResponse: null, mfaRequired: true, mfaTransaction: { secret: 'txn-secret', challenge } });
    mockCompleteTotp.mockResolvedValue({ CompletionCode: 'done', ExpiresIn: 60, RecoveryCodes: null });
    mockCompletionGrantRequest.mockResolvedValue(tokens);
    await useAuthStore.getState().login({ username: 'pat', password: 'pw' });

    const result = await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: '123456' });

    expect(result).toEqual({ ok: true, recovery: false });
    expect(mockCompletionGrantRequest).toHaveBeenCalledWith('txn-secret', 'done');
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'access', refreshToken: 'refresh', userId: 'user-9', mfaChallenge: null });
    expect(useAuthStore.getState().refreshTimeoutId).not.toBeNull();
    expect(hasLoginTransaction()).toBe(false);
  });

  it('reports a department that requires MFA this server cannot set up here', async () => {
    mockLoginRequest.mockResolvedValue({ successful: false, message: 'mfa_enrollment_required', authResponse: null, enrollmentRequired: true });
    await useAuthStore.getState().login({ username: 'pat', password: 'pw' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'error', error: 'mfa_enrollment_required' });
  });

  it('keeps the tokens when a refresh is refused because the shared session is locked', async () => {
    useAuthStore.setState({ accessToken: 'a', refreshToken: 'r', status: 'signedIn' });
    mockRefreshTokenRequest.mockRejectedValue({ response: { status: 400, data: { error: 'invalid_grant', shared_session_locked: true } } });

    await expect(useAuthStore.getState().refreshAccessToken()).resolves.toBe(false);

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'a', refreshToken: 'r', refreshTimeoutId: null });
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: true, locked: true });
  });

  it('still signs out on an ordinary refresh rejection', async () => {
    useAuthStore.setState({ accessToken: 'a', refreshToken: 'r', status: 'signedIn' });
    mockRefreshTokenRequest.mockRejectedValue(Object.assign(new Error('rejected'), { isAxiosError: true, response: { status: 400, data: { error: 'invalid_grant' } } }));

    await useAuthStore.getState().refreshAccessToken();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', accessToken: null });
  });

  it('signs out with a reason, dropping sign-in secrets and the shared session', async () => {
    mockLoginRequest.mockResolvedValue({ successful: false, message: '', authResponse: null, mfaRequired: true, mfaTransaction: { secret: 'txn-secret', challenge } });
    await useAuthStore.getState().login({ username: 'pat', password: 'pw' });
    applySharedSessionStatus({ Operator: 'pat', Client: 'unit', Shared: true, Locked: true, LockVersion: 4, LockReason: 'idle', IdleLockMinutes: 15, IdleLocksAt: null, ShiftEndsAt: null, InstallationLabel: null });

    await useAuthStore.getState().logout('shift_ended');

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', error: 'shift_ended', mfaChallenge: null, pendingRecoveryCodes: null });
    expect(hasLoginTransaction()).toBe(false);
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: false, locked: false, operator: null });
  });

  it('conceals a session restored on a shared installation before the server is asked, and not on a personal one', () => {
    const restored = { accessToken: 'a', refreshToken: 'r', refreshTokenExpiresOn: String(Date.now() + 3600000), profile: { sub: 'user-9', name: 'Pat' } as never };

    mockSharedInstallation = false;
    restoreSession(restored);
    expect(useSharedSessionStore.getState().locked).toBe(false);

    mockSharedInstallation = true;
    restoreSession(restored);
    expect(useSharedSessionStore.getState()).toMatchObject({ shared: true, locked: true });
    mockSharedInstallation = false;
  });

  it('ignores anything but a reason string, such as a press event handed straight to logout', async () => {
    await useAuthStore.getState().logout({ nativeEvent: {} } as never);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', error: null });
  });

  it('never persists the pending challenge or recovery codes', () => {
    useAuthStore.setState({ mfaChallenge: challenge, pendingRecoveryCodes: ['a-b'], accessToken: 'a' });
    const persist = (useAuthStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => Record<string, unknown> } } }).persist;
    const saved = persist.getOptions().partialize(useAuthStore.getState());
    expect(saved).not.toHaveProperty('mfaChallenge');
    expect(saved).not.toHaveProperty('pendingRecoveryCodes');
    expect(saved.accessToken).toBe('a');
  });
});
