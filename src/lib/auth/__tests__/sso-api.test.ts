import { ssoExternalTokenRequest } from '../api';

// `var` is hoisted above jest.mock so the factory lambda can close over it.
// eslint-disable-next-line no-var
var mockPost: jest.Mock = jest.fn();

jest.mock('axios', () => ({
  // Wrap in an arrow so that the binding is resolved at call-time, not factory-time.
  create: jest.fn(() => ({ post: (...args: unknown[]) => mockPost(...args) })),
  isAxiosError: jest.fn(),
}));

jest.mock('@env', () => ({
  Env: { IS_MOBILE_APP: 'true' },
}));
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.resgrid.com/api/v4'),
}));
jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('ssoExternalTokenRequest', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('returns successful response on valid OIDC token', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        access_token: 'rg-access',
        refresh_token: 'rg-refresh',
        id_token: 'rg-id',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });

    const result = await ssoExternalTokenRequest({
      provider: 'oidc',
      externalToken: 'idp-id-token',
      username: 'john.doe',
    });

    expect(result.successful).toBe(true);
    expect(result.authResponse?.access_token).toBe('rg-access');
    expect(mockPost).toHaveBeenCalledWith(
      '/connect/external-token',
      expect.stringContaining('provider=oidc'),
    );
  });

  it('returns successful response on valid SAML token', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        access_token: 'rg-access-saml',
        refresh_token: 'rg-refresh-saml',
        id_token: 'rg-id-saml',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });

    const result = await ssoExternalTokenRequest({
      provider: 'saml2',
      externalToken: 'base64SamlResponse',
      username: 'john.doe',
    });

    expect(result.successful).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/connect/external-token',
      expect.stringContaining('provider=saml2'),
    );
  });

  it('throws when the API call fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('Unauthorized'));

    await expect(
      ssoExternalTokenRequest({
        provider: 'oidc',
        externalToken: 'bad-token',
        username: 'unknown',
      }),
    ).rejects.toThrow('Unauthorized');
  });
});

