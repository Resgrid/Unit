import axios from 'axios';

import { fetchSsoConfigForUser, normalizeSsoConfig } from '../sso-discovery';

jest.mock('axios');
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.resgrid.com/api/v4'),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('fetchSsoConfigForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
  });

  it('returns config and userExists=true on success', async () => {
    const config = {
      ssoEnabled: true,
      providerType: 'oidc',
      authority: 'https://idp.example.com',
      clientId: 'client123',
      metadataUrl: null,
      entityId: null,
      samlLoginUrl: null,
      allowLocalLogin: true,
      requireSso: false,
      requireMfa: false,
      oidcRedirectUri: 'resgridunit://auth/callback',
      oidcScopes: 'openid email profile offline_access',
      departmentId: 42,
      departmentName: 'Test Department',
    };

    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: { Data: config } });

    const result = await fetchSsoConfigForUser('john.doe');

    expect(result).toEqual({ config: { ...config, departmentToken: null, brokeredSsoAvailable: false }, userExists: true });
    expect(mockedAxios.get).toHaveBeenCalledWith('https://api.resgrid.com/api/v4/connect/sso-config-for-user', { params: { username: 'john.doe' }, headers: { 'X-Resgrid-Client': 'unit' } });
  });

  it('passes departmentId when provided', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: { Data: { ssoEnabled: false } } });

    await fetchSsoConfigForUser('john.doe', 99);

    expect(mockedAxios.get).toHaveBeenCalledWith('https://api.resgrid.com/api/v4/connect/sso-config-for-user', { params: { username: 'john.doe', departmentId: 99 }, headers: { 'X-Resgrid-Client': 'unit' } });
  });

  it('returns { config: null, userExists: false } when Data is missing', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: {} });

    const result = await fetchSsoConfigForUser('unknown');

    expect(result).toEqual({ config: null, userExists: false });
  });

  it('returns { config: null, userExists: false } on 404 (user not a member)', async () => {
    const axiosError = { response: { status: 404 } };
    (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValueOnce(true);
    mockedAxios.get = jest.fn().mockRejectedValueOnce(axiosError);

    const result = await fetchSsoConfigForUser('john.doe', 5);

    expect(result).toEqual({ config: null, userExists: false });
  });

  it('returns { config: null, userExists: false } on network error', async () => {
    mockedAxios.get = jest.fn().mockRejectedValueOnce(new Error('Network Error'));

    const result = await fetchSsoConfigForUser('john.doe');

    expect(result).toEqual({ config: null, userExists: false });
  });

  it('returns { config: null, userExists: false } when ssoEnabled is false', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({
      data: { Data: { ssoEnabled: false, allowLocalLogin: true } },
    });

    const result = await fetchSsoConfigForUser('localuser');

    expect(result.userExists).toBe(true);
    expect(result.config).toMatchObject({ ssoEnabled: false, allowLocalLogin: true, providerType: null, brokeredSsoAvailable: false });
  });

  it('reads the PascalCase v4 wire names, including the broker fields', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({
      data: {
        Data: {
          SsoEnabled: true,
          ProviderType: 'saml2',
          Authority: null,
          EntityId: 'urn:dept',
          AllowLocalLogin: false,
          RequireSso: true,
          RequireMfa: true,
          OidcRedirectUri: 'resgridunit://auth/callback',
          OidcScopes: '',
          DepartmentId: 7,
          DepartmentToken: 'enc-token',
          BrokeredSsoAvailable: true,
          SamlLoginUrl: 'https://api.resgrid.test/api/v4/connect/saml-mobile-login?departmentToken=enc-token',
        },
      },
    });

    const result = await fetchSsoConfigForUser('jane');

    expect(result.config).toMatchObject({
      ssoEnabled: true,
      providerType: 'saml2',
      entityId: 'urn:dept',
      allowLocalLogin: false,
      requireSso: true,
      requireMfa: true,
      departmentId: 7,
      departmentToken: 'enc-token',
      brokeredSsoAvailable: true,
      samlLoginUrl: 'https://api.resgrid.test/api/v4/connect/saml-mobile-login?departmentToken=enc-token',
    });
  });

  it('drops an unknown provider type and a non-positive department id', () => {
    expect(normalizeSsoConfig({ SsoEnabled: true, ProviderType: 'ldap', DepartmentId: 0 })).toMatchObject({ providerType: null, departmentId: null });
    expect(normalizeSsoConfig(null)).toBeNull();
    expect(normalizeSsoConfig('x')).toBeNull();
  });
});
