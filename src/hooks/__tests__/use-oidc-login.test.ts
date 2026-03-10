import { renderHook } from '@testing-library/react-native';
import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { useOidcLogin } from '../use-oidc-login';

jest.mock('expo-auth-session');
jest.mock('expo-web-browser');
jest.mock('axios');
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.resgrid.com/api/v4'),
}));
jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedAuthSession = AuthSession as jest.Mocked<typeof AuthSession>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useOidcLogin', () => {
  const mockPromptAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (mockedAuthSession.useAutoDiscovery as jest.Mock).mockReturnValue({
      authorizationEndpoint: 'https://idp.example.com/authorize',
      tokenEndpoint: 'https://idp.example.com/token',
    });

    (mockedAuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'verifier123' },
      null,
      mockPromptAsync,
    ]);

    (mockedAuthSession.makeRedirectUri as jest.Mock).mockReturnValue(
      'resgridunit://auth/callback',
    );
  });

  it('renders without error', () => {
    const { result } = renderHook(() =>
      useOidcLogin({ authority: 'https://idp.example.com', clientId: 'client123' }),
    );

    expect(result.current.request).toBeDefined();
    expect(result.current.promptAsync).toBe(mockPromptAsync);
    expect(result.current.discovery).toBeDefined();
  });

  it('returns null from exchangeForResgridToken when response is not success', async () => {
    (mockedAuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'verifier123' },
      { type: 'cancel' },
      mockPromptAsync,
    ]);

    const { result } = renderHook(() =>
      useOidcLogin({ authority: 'https://idp.example.com', clientId: 'client123' }),
    );

    const tokenResult = await result.current.exchangeForResgridToken('john.doe');
    expect(tokenResult).toBeNull();
  });

  it('returns null when id_token is missing from IdP response', async () => {
    (mockedAuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'verifier123' },
      { type: 'success', params: { code: 'auth-code-123' } },
      mockPromptAsync,
    ]);

    (mockedAuthSession.exchangeCodeAsync as jest.Mock).mockResolvedValueOnce({
      idToken: undefined,
      accessToken: 'some-token',
    });

    const { result } = renderHook(() =>
      useOidcLogin({ authority: 'https://idp.example.com', clientId: 'client123' }),
    );

    const tokenResult = await result.current.exchangeForResgridToken('john.doe');
    expect(tokenResult).toBeNull();
  });

  it('exchanges id_token for Resgrid token on success', async () => {
    (mockedAuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'verifier123' },
      { type: 'success', params: { code: 'auth-code-123' } },
      mockPromptAsync,
    ]);

    (mockedAuthSession.exchangeCodeAsync as jest.Mock).mockResolvedValueOnce({
      idToken: 'oidc-id-token',
      accessToken: 'oidc-access',
    });

    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      data: {
        access_token: 'rg-access',
        refresh_token: 'rg-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });

    const { result } = renderHook(() =>
      useOidcLogin({ authority: 'https://idp.example.com', clientId: 'client123' }),
    );

    const tokenResult = await result.current.exchangeForResgridToken('john.doe');

    expect(tokenResult).toEqual({
      access_token: 'rg-access',
      refresh_token: 'rg-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.resgrid.com/api/v4/connect/external-token',
      expect.stringContaining('external_token=oidc-id-token'),
      expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
    );
  });

  it('returns null when Resgrid API call fails', async () => {
    (mockedAuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'verifier123' },
      { type: 'success', params: { code: 'auth-code-123' } },
      mockPromptAsync,
    ]);

    (mockedAuthSession.exchangeCodeAsync as jest.Mock).mockResolvedValueOnce({
      idToken: 'oidc-id-token',
    });

    mockedAxios.post = jest.fn().mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() =>
      useOidcLogin({ authority: 'https://idp.example.com', clientId: 'client123' }),
    );

    const tokenResult = await result.current.exchangeForResgridToken('john.doe');
    expect(tokenResult).toBeNull();
  });
});
