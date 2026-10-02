import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { saveSharedInstallation } from '@/lib/mfa/shared-installation';

import SsoLogin from '../sso';

const mockSsoLogin = jest.fn();
const mockValidateSamlCallback = jest.fn();
const mockStartSaml = jest.fn();
const mockPromptAsync = jest.fn();
let mockUrlHandler: ((event: { url: string }) => Promise<void>) | null = null;

// The screen builds its form schema with `import * as z`; the global zod mock only exports `z`, so give this test a
// chainable stand-in (the schema itself is not under test here).
jest.mock('zod', () => {
  const chain: any = new Proxy(() => chain, { get: () => chain, apply: () => chain });
  return chain;
});
jest.mock('@hookform/resolvers/zod', () => ({ zodResolver: () => undefined }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-linking', () => ({
  addEventListener: jest.fn((_event: string, handler: (event: { url: string }) => Promise<void>) => {
    mockUrlHandler = handler;
    return { remove: jest.fn() };
  }),
  parse: jest.fn(() => ({ queryParams: {} })),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/sso-discovery', () => ({ fetchSsoConfigForUser: jest.fn(() => Promise.resolve({ config: null, userExists: false })) }));
jest.mock('@/hooks/use-oidc-login', () => ({
  useOidcLogin: jest.fn(() => ({ request: null, response: null, promptAsync: mockPromptAsync, exchangeForResgridToken: jest.fn() })),
}));
jest.mock('@/hooks/use-saml-login', () => ({
  useSamlLogin: jest.fn(() => ({
    startSamlLogin: mockStartSaml,
    isSamlCallback: (url: string) => url.includes('auth/callback') && url.includes('saml_response'),
    validateSamlCallback: (url: string) => mockValidateSamlCallback(url),
  })),
}));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ ssoLogin: mockSsoLogin, status: 'idle' }) }));
jest.mock('@/stores/auth/store', () => {
  const { create } = require('zustand');
  return { __esModule: true, default: create(() => ({ error: null, isSsoMfaPending: false, mfaChallenge: null })) };
});
jest.mock('@/components/ui', () => ({ FocusAwareStatusBar: () => null, View: require('react-native').View }));
jest.mock('@/components/auth/login-mfa-sheet', () => ({ LoginMfaSheet: () => null }));
jest.mock('@/components/auth/login-otp-modal', () => ({ LoginOtpModal: () => null }));
jest.mock('@/components/ui/modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ isOpen, children }: any) => (isOpen ? <View testID="sso-error-modal">{children}</View> : null),
    ModalBackdrop: () => null,
    ModalBody: ({ children }: any) => <View>{children}</View>,
    ModalContent: ({ children }: any) => <View>{children}</View>,
    ModalFooter: ({ children }: any) => <View>{children}</View>,
    ModalHeader: ({ children }: any) => <View>{children}</View>,
  };
});

describe('SsoLogin SAML callback (login CSRF)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUrlHandler = null;
  });

  it('signs in only with a SAML response the RelayState check accepted', async () => {
    mockValidateSamlCallback.mockResolvedValue({ samlResponse: 'relay-token', departmentToken: 'enc-dept' });
    render(<SsoLogin />);

    const url = 'resgridunit://auth/callback?saml_response=relay-token&department_token=enc-dept&relay_state=unit.nonce-1';
    await act(async () => mockUrlHandler!({ url }));

    expect(mockValidateSamlCallback).toHaveBeenCalledWith(url);
    // The exchange names the department the relay sent; without it the server refuses the exchange.
    expect(mockSsoLogin).toHaveBeenCalledWith({ provider: 'saml2', externalToken: 'relay-token', username: '', departmentToken: 'enc-dept' });
    expect(screen.queryByTestId('sso-error-modal')).toBeNull();
  });

  it('refuses a callback this app did not start, and signs nobody in', async () => {
    mockValidateSamlCallback.mockResolvedValue(null);
    render(<SsoLogin />);

    await act(async () => mockUrlHandler!({ url: 'resgridunit://auth/callback?saml_response=attacker-token' }));

    expect(mockSsoLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId('sso-error-modal')).toBeTruthy();
  });

  it('ignores links that are not SAML callbacks', async () => {
    render(<SsoLogin />);

    await act(async () => mockUrlHandler!({ url: 'resgridunit://calls/42' }));

    expect(mockValidateSamlCallback).not.toHaveBeenCalled();
    expect(mockSsoLogin).not.toHaveBeenCalled();
  });
});

describe('SsoLogin SAML sign-in without the broker', () => {
  const { fetchSsoConfigForUser } = jest.requireMock('@/services/sso-discovery') as { fetchSsoConfigForUser: jest.Mock };
  const start = 'https://api.example/api/v4/connect/saml-mobile-login?departmentToken=t';
  const saml = (overrides: Record<string, unknown> = {}) => ({
    ssoEnabled: true,
    providerType: 'saml2',
    brokeredSsoAvailable: false,
    samlLoginUrl: start,
    departmentToken: 'dept-token',
    ...overrides,
  });

  const pressSso = async () => {
    render(<SsoLogin />);
    // The field's own handlers: typing the username, then leaving the field, which looks the department up.
    await act(async () => screen.getByPlaceholderText('login.username_placeholder').props.onChangeText('jdoe'));
    await act(async () => screen.getByPlaceholderText('login.username_placeholder').props.onBlur());
    await act(async () => screen.UNSAFE_getByProps({ accessibilityLabel: 'login.sso_button' }).props.onPress());
  };

  beforeEach(() => jest.clearAllMocks());

  it("opens the server's SAML start page, which sends the browser on to the IdP", async () => {
    fetchSsoConfigForUser.mockResolvedValue({ config: saml(), userExists: true });
    await pressSso();
    expect(mockStartSaml).toHaveBeenCalledWith(start);
    expect(screen.queryByTestId('sso-error-modal')).toBeNull();
  });

  it('says it cannot sign in where the server names no start page', async () => {
    fetchSsoConfigForUser.mockResolvedValue({ config: saml({ samlLoginUrl: null }), userExists: true });
    await pressSso();
    expect(mockStartSaml).not.toHaveBeenCalled();
    expect(screen.getByTestId('sso-error-modal')).toBeTruthy();
  });

  it('says it cannot sign in on the web edition, which the relay cannot return to', async () => {
    const { Platform } = require('react-native');
    const os = Platform.OS;
    Platform.OS = 'web';
    try {
      fetchSsoConfigForUser.mockResolvedValue({ config: saml(), userExists: true });
      await pressSso();
      expect(mockStartSaml).not.toHaveBeenCalled();
      expect(screen.getByTestId('sso-error-modal')).toBeTruthy();
    } finally {
      Platform.OS = os;
    }
  });
});

describe('SsoLogin in the desktop app, without the broker', () => {
  const { fetchSsoConfigForUser } = jest.requireMock('@/services/sso-discovery') as { fetchSsoConfigForUser: jest.Mock };
  const { Platform } = require('react-native');
  const os = Platform.OS;
  const bridge = { legacySsoOidc: jest.fn(), legacySsoSaml: jest.fn(), legacySsoCancel: jest.fn(async () => undefined) };
  const oidcConfig = { ssoEnabled: true, providerType: 'oidc', brokeredSsoAvailable: false, authority: 'https://idp.example.com/tenant', clientId: 'resgrid-desktop', departmentToken: 'dept-token' };

  const pressSso = async () => {
    const view = render(<SsoLogin />);
    await act(async () => screen.getByPlaceholderText('login.username_placeholder').props.onChangeText('jdoe'));
    await act(async () => screen.getByPlaceholderText('login.username_placeholder').props.onBlur());
    await act(async () => screen.UNSAFE_getByProps({ accessibilityLabel: 'login.sso_button' }).props.onPress());
    return view;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
    (window as unknown as { electronAPI?: unknown }).electronAPI = bridge;
  });

  afterEach(() => {
    Platform.OS = os;
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it("signs in with the id_token the main process redeemed, not the page's own popup", async () => {
    fetchSsoConfigForUser.mockResolvedValue({ config: oidcConfig, userExists: true });
    bridge.legacySsoOidc.mockResolvedValue({ ok: true, idToken: 'idp.id.token' });

    await pressSso();

    expect(bridge.legacySsoOidc).toHaveBeenCalledWith('https://idp.example.com/tenant', 'resgrid-desktop', false);
    expect(mockPromptAsync).not.toHaveBeenCalled();
    expect(mockSsoLogin).toHaveBeenCalledWith({ provider: 'oidc', externalToken: 'idp.id.token', username: 'jdoe', departmentToken: 'dept-token' });
    expect(screen.queryByTestId('sso-error-modal')).toBeNull();
  });

  it('says nothing when the member abandons the sign-in, and shows the error when the provider refuses it', async () => {
    fetchSsoConfigForUser.mockResolvedValue({ config: oidcConfig, userExists: true });
    bridge.legacySsoOidc.mockResolvedValueOnce({ ok: false, reason: 'cancelled' });
    const first = await pressSso();
    expect(mockSsoLogin).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sso-error-modal')).toBeNull();
    first.unmount();

    bridge.legacySsoOidc.mockResolvedValueOnce({ ok: false, reason: 'denied', code: 'access_denied' });
    await pressSso();
    expect(mockSsoLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId('sso-error-modal')).toBeTruthy();
  });

  it("starts SAML on the server's page and checks the relay's link the main process received", async () => {
    const start = 'https://api.example/api/v4/connect/saml-mobile-login?departmentToken=t';
    const link = 'resgridunit://auth/callback?saml_response=relay-token&department_token=enc-dept&relay_state=unit.nonce-1';
    fetchSsoConfigForUser.mockResolvedValue({ config: { ssoEnabled: true, providerType: 'saml2', brokeredSsoAvailable: false, samlLoginUrl: start, departmentToken: 'dept-token' }, userExists: true });
    mockStartSaml.mockResolvedValue(link);
    mockValidateSamlCallback.mockResolvedValue({ samlResponse: 'relay-token', departmentToken: 'enc-dept' });

    await pressSso();

    expect(mockStartSaml).toHaveBeenCalledWith(start);
    expect(mockValidateSamlCallback).toHaveBeenCalledWith(link);
    expect(mockSsoLogin).toHaveBeenCalledWith({ provider: 'saml2', externalToken: 'relay-token', username: 'jdoe', departmentToken: 'enc-dept' });
    expect(screen.queryByTestId('sso-error-modal')).toBeNull();
  });

  it('refuses a relay link the RelayState check rejects, and says nothing when the SAML sign-in was abandoned', async () => {
    fetchSsoConfigForUser.mockResolvedValue({ config: { ssoEnabled: true, providerType: 'saml2', brokeredSsoAvailable: false, samlLoginUrl: 'https://api.example/start', departmentToken: 'd' }, userExists: true });
    mockStartSaml.mockResolvedValueOnce(null);
    const first = await pressSso();
    expect(mockValidateSamlCallback).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sso-error-modal')).toBeNull();
    first.unmount();

    mockStartSaml.mockResolvedValueOnce('resgridunit://auth/callback?saml_response=x&relay_state=unit.other');
    mockValidateSamlCallback.mockResolvedValueOnce(null);
    await pressSso();
    expect(mockSsoLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId('sso-error-modal')).toBeTruthy();
  });

  it('asks the main process for a fresh provider sign-in on a shared installation', async () => {
    saveSharedInstallation({ shared: true, label: null });
    try {
      fetchSsoConfigForUser.mockResolvedValue({ config: oidcConfig, userExists: true });
      bridge.legacySsoOidc.mockResolvedValue({ ok: true, idToken: 'idp.id.token' });
      await pressSso();
      expect(bridge.legacySsoOidc).toHaveBeenCalledWith('https://idp.example.com/tenant', 'resgrid-desktop', true);
    } finally {
      saveSharedInstallation({ shared: false, label: null });
    }
  });

  it("ends a sign-in still waiting in the member's browser when the screen closes", () => {
    const view = render(<SsoLogin />);
    expect(bridge.legacySsoCancel).not.toHaveBeenCalled();
    view.unmount();
    expect(bridge.legacySsoCancel).toHaveBeenCalledTimes(1);
  });
});
