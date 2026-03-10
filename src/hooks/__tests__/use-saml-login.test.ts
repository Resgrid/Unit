import { renderHook } from '@testing-library/react-native';
import axios from 'axios';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { useSamlLogin } from '../use-saml-login';

jest.mock('expo-web-browser');
jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('axios');
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.resgrid.com/api/v4'),
}));
jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;
const mockedLinking = Linking as jest.Mocked<typeof Linking>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useSamlLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without error', () => {
    const { result } = renderHook(() => useSamlLogin());
    expect(result.current.startSamlLogin).toBeDefined();
    expect(result.current.handleDeepLink).toBeDefined();
    expect(result.current.isSamlCallback).toBeDefined();
  });

  it('startSamlLogin opens browser with the given URL', async () => {
    (mockedWebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'dismiss' });

    const { result } = renderHook(() => useSamlLogin());
    await result.current.startSamlLogin('https://idp.example.com/saml/sso');

    expect(mockedWebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://idp.example.com/saml/sso',
    );
  });

  it('handleDeepLink returns null when saml_response param is missing', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: {},
    });

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink(
      'resgridunit://auth/callback',
      'john.doe',
    );

    expect(tokenResult).toBeNull();
  });

  it('handleDeepLink exchanges SAMLResponse for Resgrid token on success', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: { saml_response: 'base64SamlResponse' },
    });

    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      data: {
        access_token: 'rg-access',
        refresh_token: 'rg-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink(
      'resgridunit://auth/callback?saml_response=base64SamlResponse',
      'john.doe',
    );

    expect(tokenResult).toEqual({
      access_token: 'rg-access',
      refresh_token: 'rg-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.resgrid.com/api/v4/connect/external-token',
      expect.stringContaining('provider=saml2'),
      expect.any(Object),
    );
  });

  it('handleDeepLink returns null when Resgrid API call fails', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: { saml_response: 'base64SamlResponse' },
    });

    mockedAxios.post = jest.fn().mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink(
      'resgridunit://auth/callback?saml_response=base64SamlResponse',
      'john.doe',
    );

    expect(tokenResult).toBeNull();
  });

  describe('isSamlCallback', () => {
    it('returns true for SAML callback URLs', () => {
      const { result } = renderHook(() => useSamlLogin());
      expect(
        result.current.isSamlCallback(
          'resgridunit://auth/callback?saml_response=abc123',
        ),
      ).toBe(true);
    });

    it('returns false for OIDC callback URLs without saml_response', () => {
      const { result } = renderHook(() => useSamlLogin());
      expect(
        result.current.isSamlCallback('resgridunit://auth/callback?code=abc&state=xyz'),
      ).toBe(false);
    });

    it('returns false for unrelated URLs', () => {
      const { result } = renderHook(() => useSamlLogin());
      expect(result.current.isSamlCallback('https://example.com')).toBe(false);
    });
  });
});
