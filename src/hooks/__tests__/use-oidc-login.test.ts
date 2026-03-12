import { renderHook } from '@testing-library/react-native';
import * as AuthSession from 'expo-auth-session';

import { useOidcLogin } from '../use-oidc-login';

jest.mock('expo-auth-session');
jest.mock('expo-web-browser');
jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedAuthSession = AuthSession as jest.Mocked<typeof AuthSession>;

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

    const tokenResult = await result.current.exchangeForResgridToken();
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

    const tokenResult = await result.current.exchangeForResgridToken();
    expect(tokenResult).toBeNull();
  });

  it('returns the IdP id_token string on success', async () => {
    (mockedAuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'verifier123' },
      { type: 'success', params: { code: 'auth-code-123' } },
      mockPromptAsync,
    ]);

    (mockedAuthSession.exchangeCodeAsync as jest.Mock).mockResolvedValueOnce({
      idToken: 'oidc-id-token',
      accessToken: 'oidc-access',
    });

    const { result } = renderHook(() =>
      useOidcLogin({ authority: 'https://idp.example.com', clientId: 'client123' }),
    );

    const tokenResult = await result.current.exchangeForResgridToken();

    expect(tokenResult).toBe('oidc-id-token');
  });

  it('returns null when IdP code exchange fails', async () => {
    (mockedAuthSession.useAuthRequest as jest.Mock).mockReturnValue([
      { codeVerifier: 'verifier123' },
      { type: 'success', params: { code: 'auth-code-123' } },
      mockPromptAsync,
    ]);

    (mockedAuthSession.exchangeCodeAsync as jest.Mock).mockRejectedValueOnce(new Error('IdP Error'));

    const { result } = renderHook(() =>
      useOidcLogin({ authority: 'https://idp.example.com', clientId: 'client123' }),
    );

    const tokenResult = await result.current.exchangeForResgridToken();
    expect(tokenResult).toBeNull();
  });
});
