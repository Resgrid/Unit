import { logger } from '@/lib/logging';

const mockPost = jest.fn();

jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: () => 'https://api.test/api/v4' }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('@env', () => ({ Env: { IS_MOBILE_APP: true } }));
jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn(() => ({ interceptors: { request: { use: jest.fn() } }, post: mockPost })) },
}));

// Required after the mocks exist: the module creates its axios instance at load.
const { loginRequest } = require('../api') as typeof import('../api');

const axiosError = (status?: number, data?: unknown) =>
  Object.assign(new Error(status ? `Request failed with status code ${status}` : 'timeout of 15000ms exceeded'), {
    isAxiosError: true,
    code: status ? 'ERR_BAD_REQUEST' : 'ECONNABORTED',
    response: status ? { status, data } : undefined,
  });

describe('a refused password sign-in', () => {
  beforeEach(() => {
    mockPost.mockReset();
    jest.clearAllMocks();
  });

  it('answers with the reason the server gives instead of throwing', async () => {
    mockPost.mockRejectedValue(axiosError(400, { error: 'invalid_grant', error_description: 'Locked out.', login_error: 'account_locked_out', lockout_minutes_remaining: 12 }));

    const response = await loginRequest({ username: 'user1', password: 'pw' });

    expect(response).toEqual({ successful: false, message: 'account_locked_out', authResponse: null, failure: { code: 'account_locked_out', lockoutMinutes: 12 } });
    expect(logger.error).toHaveBeenCalledWith({ message: 'Login failed', context: expect.objectContaining({ loginFailure: 'account_locked_out', loginError: 'account_locked_out' }) });
  });

  it('reports a sign-in that timed out as an unreachable server', async () => {
    mockPost.mockRejectedValue(axiosError());

    expect(await loginRequest({ username: 'user1', password: 'pw' })).toMatchObject({ successful: false, message: 'server_unreachable', failure: { code: 'server_unreachable' } });
  });

  it('never logs a login_error the server does not send', async () => {
    for (const unsafe of ['user@example.com', 'mysecretpassword']) {
      (logger.error as jest.Mock).mockClear();
      mockPost.mockRejectedValue(axiosError(400, { error: 'invalid_grant', login_error: unsafe }));

      expect(await loginRequest({ username: 'user1', password: 'pw' })).toMatchObject({ failure: { code: 'invalid_credentials' } });
      expect((logger.error as jest.Mock).mock.calls[0][0].context).not.toHaveProperty('loginError');
    }
  });

  it('keeps the second-factor challenge apart from a refusal', async () => {
    mockPost.mockRejectedValue(axiosError(400, { error: 'invalid_totp' }));

    const response = await loginRequest({ username: 'user1', password: 'pw', otpCode: '123456' });

    expect(response).toMatchObject({ mfaRequired: true, invalidOtp: true });
    expect(response.failure).toBeUndefined();
  });
});
