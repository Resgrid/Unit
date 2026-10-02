import { renderHook } from '@testing-library/react-native';
import axios from 'axios';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { isSharedInstallation } from '@/lib/mfa/shared-installation';
import { getItem, removeItem, setItem } from '@/lib/storage';

import { useSamlLogin } from '../use-saml-login';

jest.mock('expo-web-browser');
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));
jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('axios');
jest.mock('@/lib/mfa/shared-installation', () => ({ isSharedInstallation: jest.fn(() => false) }));
jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.resgrid.com/api/v4'),
}));
jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;
const mockedLinking = Linking as jest.Mocked<typeof Linking>;
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockedGetItem = getItem as jest.Mock;
const mockedSetItem = setItem as jest.Mock;
const mockedRemoveItem = removeItem as jest.Mock;

const TEST_NONCE = 'test-nonce-123';

describe('useSamlLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockedCrypto.randomUUID as jest.Mock).mockReturnValue(TEST_NONCE);
    mockedSetItem.mockResolvedValue(undefined);
    mockedRemoveItem.mockResolvedValue(undefined);
    mockedGetItem.mockReturnValue(null);
  });

  it('renders without error', () => {
    const { result } = renderHook(() => useSamlLogin());
    expect(result.current.startSamlLogin).toBeDefined();
    expect(result.current.handleDeepLink).toBeDefined();
    expect(result.current.isSamlCallback).toBeDefined();
    expect(result.current.validateSamlCallback).toBeDefined();
  });

  it('startSamlLogin stores a RelayState nonce and opens browser with it appended', async () => {
    (mockedWebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'dismiss' });

    const { result } = renderHook(() => useSamlLogin());
    await result.current.startSamlLogin('https://idp.example.com/saml/sso');

    // Tagged with this app's name so the server's relay returns here (every app shares one ACS URL).
    expect(mockedSetItem).toHaveBeenCalledWith('saml_pending_relay_state', `unit.${TEST_NONCE}`);
    expect(mockedWebBrowser.openBrowserAsync).toHaveBeenCalledWith(`https://idp.example.com/saml/sso?RelayState=unit.${TEST_NONCE}`);
  });

  it("startSamlLogin in the desktop app hands the start page to the main process and returns the relay's link", async () => {
    const legacySsoSaml = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, url: 'resgridunit://auth/callback?saml_response=r&relay_state=unit.' + TEST_NONCE })
      .mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    (window as unknown as { electronAPI?: unknown }).electronAPI = { legacySsoOidc: jest.fn(), legacySsoSaml, legacySsoCancel: jest.fn() };
    try {
      const { result } = renderHook(() => useSamlLogin());

      await expect(result.current.startSamlLogin('https://api.resgrid.com/api/v4/connect/saml-mobile-login?departmentToken=t')).resolves.toBe('resgridunit://auth/callback?saml_response=r&relay_state=unit.' + TEST_NONCE);
      expect(legacySsoSaml).toHaveBeenCalledWith(`https://api.resgrid.com/api/v4/connect/saml-mobile-login?departmentToken=t&RelayState=unit.${TEST_NONCE}`);
      expect(mockedSetItem).toHaveBeenCalledWith('saml_pending_relay_state', `unit.${TEST_NONCE}`);
      expect(mockedWebBrowser.openBrowserAsync).not.toHaveBeenCalled();

      await expect(result.current.startSamlLogin('https://api.resgrid.com/start')).resolves.toBeNull();
    } finally {
      delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    }
  });

  it('startSamlLogin on a shared installation asks the IdP to authenticate the member again', async () => {
    (isSharedInstallation as jest.Mock).mockReturnValueOnce(true);
    (mockedWebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'opened' });
    const { result } = renderHook(() => useSamlLogin());
    await result.current.startSamlLogin('https://api.resgrid.com/start?departmentToken=t');
    expect(mockedWebBrowser.openBrowserAsync).toHaveBeenCalledWith(`https://api.resgrid.com/start?departmentToken=t&RelayState=unit.${TEST_NONCE}&forceAuthn=true`);
  });

  it('startSamlLogin on a phone opens the browser and returns nothing: the deep link brings the answer', async () => {
    (mockedWebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'opened' });
    const { result } = renderHook(() => useSamlLogin());
    await expect(result.current.startSamlLogin('https://api.resgrid.com/start')).resolves.toBeNull();
  });

  it('startSamlLogin uses & separator when the URL already has a query string', async () => {
    (mockedWebBrowser.openBrowserAsync as jest.Mock).mockResolvedValueOnce({ type: 'dismiss' });

    const { result } = renderHook(() => useSamlLogin());
    await result.current.startSamlLogin('https://idp.example.com/saml/sso?foo=bar');

    expect(mockedWebBrowser.openBrowserAsync).toHaveBeenCalledWith(`https://idp.example.com/saml/sso?foo=bar&RelayState=unit.${TEST_NONCE}`);
  });

  it('handleDeepLink returns null when saml_response param is missing', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: {},
    });

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink('resgridunit://auth/callback', 'john.doe');

    expect(tokenResult).toBeNull();
  });

  it('handleDeepLink returns null when relay state validation fails', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: { saml_response: 'base64SamlResponse', relay_state: 'attacker-state' },
    });
    mockedGetItem.mockReturnValue(TEST_NONCE);

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink('resgridunit://auth/callback?saml_response=base64SamlResponse&relay_state=attacker-state', 'john.doe');

    expect(tokenResult).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedRemoveItem).not.toHaveBeenCalled();
  });

  it('handleDeepLink exchanges SAMLResponse for Resgrid token on success', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: { saml_response: 'base64SamlResponse', relay_state: TEST_NONCE, department_token: 'enc-dept' },
    });
    mockedGetItem.mockReturnValue(TEST_NONCE);

    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      data: {
        access_token: 'rg-access',
        refresh_token: 'rg-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink(`resgridunit://auth/callback?saml_response=base64SamlResponse&relay_state=${TEST_NONCE}`, 'john.doe');

    expect(tokenResult).toEqual({
      access_token: 'rg-access',
      refresh_token: 'rg-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
    });

    expect(mockedAxios.post).toHaveBeenCalledWith('https://api.resgrid.com/api/v4/connect/external-token', expect.stringContaining('provider=saml2'), expect.any(Object));
    // The exchange names the department the relay sent; without it the server refuses.
    expect((mockedAxios.post as jest.Mock).mock.calls[0][1]).toContain('department_token=enc-dept');

    // Nonce consumed on success
    expect(mockedRemoveItem).toHaveBeenCalledWith('saml_pending_relay_state');
  });

  it('handleDeepLink returns null when Resgrid API call fails', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: { saml_response: 'base64SamlResponse', relay_state: TEST_NONCE },
    });
    mockedGetItem.mockReturnValue(TEST_NONCE);

    mockedAxios.post = jest.fn().mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink(`resgridunit://auth/callback?saml_response=base64SamlResponse&relay_state=${TEST_NONCE}`, 'john.doe');

    expect(tokenResult).toBeNull();
  });

  it('handleDeepLink catches RelayState storage read failures', async () => {
    (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
      scheme: 'resgridunit',
      path: 'auth/callback',
      queryParams: { saml_response: 'base64SamlResponse', relay_state: TEST_NONCE },
    });
    mockedGetItem.mockRejectedValueOnce(new Error('Storage read failed'));

    const { result } = renderHook(() => useSamlLogin());
    const tokenResult = await result.current.handleDeepLink(`resgridunit://auth/callback?saml_response=base64SamlResponse&relay_state=${TEST_NONCE}`, 'john.doe');

    expect(tokenResult).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  describe('validateSamlCallback', () => {
    it('returns the saml_response and consumes the nonce when relay state matches', async () => {
      (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
        scheme: 'resgridunit',
        path: 'auth/callback',
        queryParams: { saml_response: 'base64SamlResponse', relay_state: TEST_NONCE, department_token: 'enc-dept' },
      });
      mockedGetItem.mockResolvedValue(TEST_NONCE);

      const { result } = renderHook(() => useSamlLogin());
      const samlResponse = await result.current.validateSamlCallback(`resgridunit://auth/callback?saml_response=base64SamlResponse&relay_state=${TEST_NONCE}`);

      expect(samlResponse).toEqual({ samlResponse: 'base64SamlResponse', departmentToken: 'enc-dept' });
      expect(mockedRemoveItem).toHaveBeenCalledWith('saml_pending_relay_state');
    });

    it('returns null when no SAML flow is pending', async () => {
      (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
        scheme: 'resgridunit',
        path: 'auth/callback',
        queryParams: { saml_response: 'base64SamlResponse', relay_state: TEST_NONCE },
      });
      mockedGetItem.mockReturnValue(null);

      const { result } = renderHook(() => useSamlLogin());
      const samlResponse = await result.current.validateSamlCallback(`resgridunit://auth/callback?saml_response=base64SamlResponse&relay_state=${TEST_NONCE}`);

      expect(samlResponse).toBeNull();
      expect(mockedRemoveItem).not.toHaveBeenCalled();
    });

    it('returns null when relay_state does not match the pending nonce', async () => {
      (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
        scheme: 'resgridunit',
        path: 'auth/callback',
        queryParams: { saml_response: 'base64SamlResponse', relay_state: 'wrong-state' },
      });
      mockedGetItem.mockReturnValue(TEST_NONCE);

      const { result } = renderHook(() => useSamlLogin());
      const samlResponse = await result.current.validateSamlCallback('resgridunit://auth/callback?saml_response=base64SamlResponse&relay_state=wrong-state');

      expect(samlResponse).toBeNull();
      expect(mockedRemoveItem).not.toHaveBeenCalled();
    });

    it('returns null when relay_state param is missing', async () => {
      (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
        scheme: 'resgridunit',
        path: 'auth/callback',
        queryParams: { saml_response: 'base64SamlResponse' },
      });
      mockedGetItem.mockReturnValue(TEST_NONCE);

      const { result } = renderHook(() => useSamlLogin());
      const samlResponse = await result.current.validateSamlCallback('resgridunit://auth/callback?saml_response=base64SamlResponse');

      expect(samlResponse).toBeNull();
      expect(mockedRemoveItem).not.toHaveBeenCalled();
    });

    it('returns null when saml_response param is missing', async () => {
      (mockedLinking.parse as jest.Mock).mockReturnValueOnce({
        scheme: 'resgridunit',
        path: 'auth/callback',
        queryParams: { relay_state: TEST_NONCE },
      });
      mockedGetItem.mockReturnValue(TEST_NONCE);

      const { result } = renderHook(() => useSamlLogin());
      const samlResponse = await result.current.validateSamlCallback(`resgridunit://auth/callback?relay_state=${TEST_NONCE}`);

      expect(samlResponse).toBeNull();
      expect(mockedRemoveItem).not.toHaveBeenCalled();
    });
  });

  describe('isSamlCallback', () => {
    it('returns true for SAML callback URLs', () => {
      const { result } = renderHook(() => useSamlLogin());
      expect(result.current.isSamlCallback('resgridunit://auth/callback?saml_response=abc123')).toBe(true);
    });

    it('returns false for OIDC callback URLs without saml_response', () => {
      const { result } = renderHook(() => useSamlLogin());
      expect(result.current.isSamlCallback('resgridunit://auth/callback?code=abc&state=xyz')).toBe(false);
    });

    it('returns false for unrelated URLs', () => {
      const { result } = renderHook(() => useSamlLogin());
      expect(result.current.isSamlCallback('https://example.com')).toBe(false);
    });
  });
});
