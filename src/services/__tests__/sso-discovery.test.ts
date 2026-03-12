import axios from 'axios';

import { fetchSsoConfigForUser } from '../sso-discovery';

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
      idpSsoUrl: null,
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

    expect(result).toEqual({ config, userExists: true });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.resgrid.com/api/v4/connect/sso-config-for-user',
      { params: { username: 'john.doe' } },
    );
  });

  it('passes departmentId when provided', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: { Data: { ssoEnabled: false } } });

    await fetchSsoConfigForUser('john.doe', 99);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.resgrid.com/api/v4/connect/sso-config-for-user',
      { params: { username: 'john.doe', departmentId: 99 } },
    );
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

    expect(result).toEqual({
      config: { ssoEnabled: false, allowLocalLogin: true },
      userExists: true,
    });
  });
});
