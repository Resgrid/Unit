/**
 * The eight sign-in journeys, through this app's own sign-in code, against the real Resgrid sign-in server over real
 * HTTP: Core's LiveSignInServer (the real token endpoint, bearer validation, session middleware and sign-in services),
 * served by the LiveSignInHost fixture. Skipped unless RESGRID_LIVE_API names that server, for example:
 *
 *   (Core) RESGRID_LIVE_PORT=5098 dotnet test Tests/Resgrid.Tests --filter FullyQualifiedName~LiveSignInHost
 *   (here) RESGRID_LIVE_API=http://127.0.0.1:5098 npx jest sign-in-journeys.live
 *
 * The server's /__live endpoints seed members and switch the deployment's gates, and play what is outside this app: the
 * identity provider's sign-in page, this device's passkey (the native module is the only stand-in here), and the
 * member's Responder approving on their own phone.
 */
import { act, renderHook } from '@testing-library/react-native';
import axios from 'axios';
import * as WebBrowser from 'expo-web-browser';
import { Passkey } from 'react-native-passkey';

import { getPasskeyRegistrationOptions, getStepUpOptions, verifyStepUp } from '@/api/mfa/account-security';
import { completeUnlock, getUnlockApprovalStatus, getUnlockOptions, lockSession, requestUnlockApproval } from '@/api/mfa/shared-session';
import { getStepUpMethods, getStepUpPasskeyOptions, requestProtectedGrant, verifyStepUpPasskey } from '@/api/data-protection/data-protection';
import { useSamlLogin } from '@/hooks/use-saml-login';
import type { DesktopLegacySso } from '@/lib/mfa/legacy-sso-desktop';
import { getPasskeyAssertion } from '@/lib/mfa/passkey';
import { isSharedInstallation, saveSharedInstallation } from '@/lib/mfa/shared-installation';
import { setBaseApiUrl } from '@/lib/storage/app';
import { fetchSsoConfigForUser } from '@/services/sso-discovery';
import { forgetLoginSecrets } from '@/stores/auth/login-mfa';
import useAuthStore from '@/stores/auth/store';

/** expo-linking's parse needs expo-constants, which Jest lacks: read the link as a device does (scheme, host, path, query). */
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  parse: (url: string) => {
    const link = new URL(url);
    return { scheme: link.protocol.replace(/:$/, ''), hostname: link.hostname || null, path: link.pathname.replace(/^\//, '') || null, queryParams: Object.fromEntries(link.searchParams) };
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createLegacySso } = require('../../../../electron/legacy-sso');

const LIVE = process.env.RESGRID_LIVE_API;
const describeLive = LIVE ? describe : describe.skip;
const CLIENT = 'unit';
const RETURN_TARGET = 'resgridunit://sso-return';
const FAKE_IDP = 'https://idp.example.test';
const FAKE_IDP_AUTHORIZE = 'https://idp.example.test/authorize';
const FAKE_SAML_IDP = 'https://idp.example.test/saml2/sso';
const SAML_CALLBACK = 'resgridunit://auth/callback';

interface LiveUser {
  userId: string;
  username: string;
  password: string;
  departmentToken: string;
  externalSubject: string | null;
}

interface LiveSession {
  client: string;
  sharedMode: boolean;
  authentication: string;
  loginMfa: string | null;
}

const control = async <T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> => (await axios.post<T>(`${LIVE}/__live/${path}`, body)).data;
const gates = (on: boolean) => control('gates', { transaction: on, brokeredSso: on, passkeys: on, approval: on, providerStepUp: on, sharedDevice: on });
const newUser = (spec: Record<string, unknown>) => control<LiveUser>('users', spec);
const totp = async (user: LiveUser) => (await control<{ code: string }>('totp', { userId: user.userId })).code;
const sessionsOf = (user: LiveUser) => control<LiveSession[]>('sessions', { userId: user.userId });
const thisAppsSession = async (user: LiveUser) => (await sessionsOf(user)).filter((s) => s.client === CLIENT);

/** The system browser: the provider's sign-in page (the server's fake IdP), then the broker's callback, back to this app. */
const browser = async (url: string, returnTarget: string): Promise<WebBrowser.WebBrowserAuthSessionResult> => {
  // The providers' pages are the server's stand-ins: its OIDC authorize page and its SAML IdP.
  const toLive = (link: string) =>
    link.startsWith(FAKE_IDP_AUTHORIZE)
      ? `${LIVE}/__live/idp/authorize${link.substring(FAKE_IDP_AUTHORIZE.length)}`
      : link.startsWith(FAKE_SAML_IDP)
        ? `${LIVE}/__live/idp/saml${link.substring(FAKE_SAML_IDP.length)}`
        : link;
  let next = toLive(url);
  const dismissed = { type: 'dismiss' } as WebBrowser.WebBrowserAuthSessionResult;
  for (let hop = 0; hop < 5; hop++) {
    if (next.startsWith(returnTarget)) {
      return { type: 'success', url: next };
    }
    // Each redirect by hand, reading the Location header as sent: the last one is this app's own scheme.
    const response = await fetch(next, { redirect: 'manual' });
    next = toLive(response.headers.get('location') ?? '');
    if (!next) {
      return dismissed;
    }
  }
  return dismissed;
};

/** The claims of a protected-data grant (a signed JWT): which second factor stands behind it. */
const grantClaims = (grant: string): Record<string, unknown> => JSON.parse(Buffer.from(grant.split('.')[1], 'base64url').toString('utf8'));

/** A legacy SAML sign-in through this app's own hook: the server's start page, the IdP, and the relay's link back to this app. */
const samlRoundTrip = async (user: LiveUser, signInUrl: string) => {
  await control('idp/next', { subject: user.externalSubject });
  let returned = '';
  (WebBrowser.openBrowserAsync as jest.Mock).mockImplementation(async (url: string) => {
    returned = ((await browser(url, SAML_CALLBACK)) as { url?: string }).url ?? '';
    return { type: 'opened' };
  });
  const { result, unmount } = renderHook(() => useSamlLogin());
  await act(async () => {
    await result.current.startSamlLogin(signInUrl);
  });
  const callback = await result.current.validateSamlCallback(returned);
  unmount();
  if (!callback) {
    throw new Error('the app refused its own SAML callback: ' + returned);
  }
  return callback;
};

/**
 * The desktop app's main process (electron/legacy-sso.js) on the live server: it reads the provider's discovery document
 * and redeems the code at the server's stand-in provider, the member's browser follows the real redirects, and the OS
 * hands the app's scheme link back to it. The page reaches it through the same bridge the desktop preload exposes.
 */
const desktopApp = () => {
  const toLive = (url: string) => (url.startsWith(`${FAKE_IDP}/`) ? `${LIVE}/__live/idp${url.substring(FAKE_IDP.length)}` : url);
  const legacySso = createLegacySso({
    scheme: 'resgridunit',
    fetch: (url: string, init?: RequestInit) => fetch(toLive(url), init),
    openExternal: async (url: string) => {
      void browser(url, SAML_CALLBACK).then((returned) => legacySso.handleLink((returned as { url?: string }).url ?? ''));
    },
  });
  const bridge: DesktopLegacySso = {
    legacySsoOidc: (authority, clientId, reauthenticate) => legacySso.oidc(authority, clientId, reauthenticate),
    legacySsoSaml: (signInUrl) => legacySso.saml(signInUrl),
    legacySsoCancel: async () => legacySso.cancel(),
  };
  (window as unknown as { electronAPI?: DesktopLegacySso }).electronAPI = bridge;
  return bridge;
};

const signedIn = () => {
  const state = useAuthStore.getState();
  return state.status === 'signedIn' && !!state.accessToken;
};

describeLive('sign-in journeys against the live Resgrid sign-in server (Unit)', () => {
  jest.setTimeout(60000);

  beforeAll(() => {
    jest.useRealTimers();
    setBaseApiUrl(`${LIVE}/api/v4`);
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockImplementation((url: string, returnTarget: string) => browser(url, returnTarget));
    (Passkey.isSupported as jest.Mock).mockReturnValue(true);
    // This device's passkey: the server's soft authenticator answers the options this app hands the native module.
    (Passkey.get as jest.Mock).mockImplementation(async (request: unknown) => control('authenticator/assert', { options: request, client: CLIENT }));
  });

  beforeEach(() => {
    jest.useRealTimers();
    forgetLoginSecrets();
    const timer = useAuthStore.getState().refreshTimeoutId;
    if (timer) {
      clearTimeout(timer);
    }
    useAuthStore.setState({ status: 'signedOut', accessToken: null, refreshToken: null, refreshTimeoutId: null, mfaChallenge: null, isSsoMfaPending: false, error: null });
    saveSharedInstallation({ shared: false, label: null });
  });

  afterEach(() => {
    const timer = useAuthStore.getState().refreshTimeoutId;
    if (timer) {
      clearTimeout(timer);
    }
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  describe("with every new switch off (today's deployments)", () => {
    beforeEach(() => gates(false));

    it('1. signs in with a password alone', async () => {
      const user = await newUser({});
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      expect(signedIn()).toBe(true);
      expect(await thisAppsSession(user)).toEqual([expect.objectContaining({ authentication: 'LocalPassword', loginMfa: null })]);
    });

    it('2. signs in with a password and an authenticator code, resent with the password', async () => {
      const user = await newUser({ totp: true });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      expect(useAuthStore.getState().status).toBe('mfaRequired');
      expect(useAuthStore.getState().mfaChallenge?.kind).toBe('legacy');

      await useAuthStore.getState().login({ username: user.username, password: user.password, otpCode: await totp(user) });
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].loginMfa).toBe('totp');
    });

    it("3. signs in through the department's provider with discovery's department token", async () => {
      const user = await newUser({ sso: true });
      const discovery = await fetchSsoConfigForUser(user.username);
      expect(discovery.config?.brokeredSsoAvailable).toBe(false);
      expect(discovery.config?.oidcRedirectUri).toBe('resgridunit://auth/callback');
      const { id_token } = await control<{ id_token: string }>('idp/legacy-token', { subject: user.externalSubject });

      await useAuthStore.getState().ssoLogin({ provider: 'oidc', externalToken: id_token, username: user.username, departmentToken: discovery.config!.departmentToken! });
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].authentication).toBe('OidcSso');
    });

    it('4. a member whose provider does the MFA and who has no authenticator signs straight in', async () => {
      const user = await newUser({ sso: true, providerMfa: true });
      const { id_token } = await control<{ id_token: string }>('idp/legacy-token', { subject: user.externalSubject });
      await useAuthStore.getState().ssoLogin({ provider: 'oidc', externalToken: id_token, username: user.username, departmentToken: user.departmentToken });
      expect(signedIn()).toBe(true);
    });

    it("5. signs in through the provider, then resends the same exchange with the member's code", async () => {
      const user = await newUser({ sso: true, totp: true });
      const { id_token } = await control<{ id_token: string }>('idp/legacy-token', { subject: user.externalSubject });

      await useAuthStore.getState().ssoLogin({ provider: 'oidc', externalToken: id_token, username: user.username, departmentToken: user.departmentToken });
      expect(useAuthStore.getState().status).toBe('mfaRequired');
      expect(useAuthStore.getState().isSsoMfaPending).toBe(true);

      await useAuthStore.getState().retrySsoWithOtp(await totp(user));
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0]).toEqual(expect.objectContaining({ authentication: 'OidcSso', loginMfa: 'totp' }));
    });

    it("3. signs in through a SAML provider: the server's start page, the relay back to this app, and the exchange", async () => {
      const user = await newUser({ sso: true, saml: true });
      const { config } = await fetchSsoConfigForUser(user.username);
      expect(config).toEqual(expect.objectContaining({ providerType: 'saml2', brokeredSsoAvailable: false, samlLoginUrl: expect.stringContaining('/connect/saml-mobile-login?departmentToken=') }));
      const callback = await samlRoundTrip(user, config!.samlLoginUrl!);

      await useAuthStore.getState().ssoLogin({ provider: 'saml2', externalToken: callback.samlResponse, username: user.username, departmentToken: callback.departmentToken ?? undefined });
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].authentication).toBe('SamlSso');
    });

    it("5. signs in through a SAML provider, then resends the same relay token with the member's code", async () => {
      const user = await newUser({ sso: true, saml: true, totp: true });
      const { config } = await fetchSsoConfigForUser(user.username);
      const callback = await samlRoundTrip(user, config!.samlLoginUrl!);

      await useAuthStore.getState().ssoLogin({ provider: 'saml2', externalToken: callback.samlResponse, username: user.username, departmentToken: callback.departmentToken ?? undefined });
      expect(useAuthStore.getState().isSsoMfaPending).toBe(true);
      await useAuthStore.getState().retrySsoWithOtp(await totp(user));
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0]).toEqual(expect.objectContaining({ authentication: 'SamlSso', loginMfa: 'totp' }));
    });

    it("3. signs in from the desktop app through the provider: the main process's own code flow, back on this app's scheme", async () => {
      const user = await newUser({ sso: true });
      const { config } = await fetchSsoConfigForUser(user.username);
      const desktop = desktopApp();
      await control('idp/next', { subject: user.externalSubject });

      const answer = await desktop.legacySsoOidc(config!.authority!, config!.clientId!);
      expect(answer).toEqual({ ok: true, idToken: expect.any(String) });
      await useAuthStore.getState().ssoLogin({ provider: 'oidc', externalToken: (answer as { idToken: string }).idToken, username: user.username, departmentToken: config!.departmentToken ?? undefined });
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].authentication).toBe('OidcSso');
    });

    it('3. on a shared desktop, signs the next operator in afresh, though the provider still remembers the last one', async () => {
      const previous = await newUser({ sso: true });
      const next = await newUser({ sso: true, colleagueOf: previous.userId });
      saveSharedInstallation({ shared: true, label: 'Station 1 desk' });
      await control('idp/session', { subject: previous.externalSubject, minutesAgo: 60 });
      try {
        const { config } = await fetchSsoConfigForUser(next.username);
        const desktop = desktopApp();
        await control('idp/next', { subject: next.externalSubject });

        // Not asked for a fresh sign-in, the provider answers as the previous operator, and the server refuses it here.
        const remembered = await desktop.legacySsoOidc(config!.authority!, config!.clientId!, false);
        expect(remembered.ok).toBe(true);
        await useAuthStore.getState().ssoLogin({ provider: 'oidc', externalToken: (remembered as { idToken: string }).idToken, username: next.username, departmentToken: config!.departmentToken ?? undefined });
        expect(signedIn()).toBe(false);
        expect(await thisAppsSession(previous)).toEqual([]);

        // The screen asks for one on a shared installation, and the provider signs in the operator at the desk.
        const fresh = await desktop.legacySsoOidc(config!.authority!, config!.clientId!, isSharedInstallation());
        await useAuthStore.getState().ssoLogin({ provider: 'oidc', externalToken: (fresh as { idToken: string }).idToken, username: next.username, departmentToken: config!.departmentToken ?? undefined });
        expect(signedIn()).toBe(true);
        expect(await thisAppsSession(next)).toHaveLength(1);
        expect(await thisAppsSession(previous)).toEqual([]);
      } finally {
        await control('idp/session', {});
        saveSharedInstallation({ shared: false, label: null });
      }
    });

    it('3. on a shared desktop, SAML asks the IdP to sign the next operator in afresh, though it still remembers the last one', async () => {
      const previous = await newUser({ sso: true, saml: true });
      const next = await newUser({ sso: true, saml: true, colleagueOf: previous.userId });
      saveSharedInstallation({ shared: true, label: 'Station 1 desk' });
      await control('idp/session', { subject: previous.externalSubject, minutesAgo: 60 });
      try {
        const { config } = await fetchSsoConfigForUser(next.username);
        desktopApp();
        await control('idp/next', { subject: next.externalSubject });

        const { result, unmount } = renderHook(() => useSamlLogin());
        let link: string | null = null;
        await act(async () => {
          link = await result.current.startSamlLogin(config!.samlLoginUrl!);
        });
        const callback = await result.current.validateSamlCallback(link!);
        unmount();
        await useAuthStore.getState().ssoLogin({ provider: 'saml2', externalToken: callback!.samlResponse, username: next.username, departmentToken: callback!.departmentToken ?? undefined });
        expect(signedIn()).toBe(true);
        expect(await thisAppsSession(next)).toHaveLength(1);
        expect(await thisAppsSession(previous)).toEqual([]);
      } finally {
        await control('idp/session', {});
        saveSharedInstallation({ shared: false, label: null });
      }
    });

    it("5. signs in from the desktop app through a SAML provider, then with the member's code", async () => {
      const user = await newUser({ sso: true, saml: true, totp: true });
      const { config } = await fetchSsoConfigForUser(user.username);
      desktopApp();
      await control('idp/next', { subject: user.externalSubject });

      const { result, unmount } = renderHook(() => useSamlLogin());
      let link: string | null = null;
      await act(async () => {
        link = await result.current.startSamlLogin(config!.samlLoginUrl!);
      });
      const callback = await result.current.validateSamlCallback(link!);
      unmount();
      expect(callback).not.toBeNull();

      await useAuthStore.getState().ssoLogin({ provider: 'saml2', externalToken: callback!.samlResponse, username: user.username, departmentToken: callback!.departmentToken ?? undefined });
      expect(useAuthStore.getState().isSsoMfaPending).toBe(true);
      await useAuthStore.getState().retrySsoWithOtp(await totp(user));
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0]).toEqual(expect.objectContaining({ authentication: 'SamlSso', loginMfa: 'totp' }));
    });
  });

  describe("with the plan's switches on", () => {
    beforeEach(() => gates(true));

    it('1. signs in with a password alone', async () => {
      const user = await newUser({});
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      expect(signedIn()).toBe(true);
    });

    it('2. signs in with a password and an authenticator code on the login transaction', async () => {
      const user = await newUser({ totp: true });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      const challenge = useAuthStore.getState().mfaChallenge;
      expect(challenge).toEqual(expect.objectContaining({ kind: 'verify', source: 'password', enrolled: ['totp'] }));

      expect(await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: await totp(user) })).toEqual(expect.objectContaining({ ok: true }));
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].loginMfa).toBe('totp');
    });

    it('3. signs in through the broker, with no MFA', async () => {
      const user = await newUser({ sso: true });
      const discovery = await fetchSsoConfigForUser(user.username);
      expect(discovery.config?.brokeredSsoAvailable).toBe(true);
      await control('idp/next', { subject: user.externalSubject });

      await useAuthStore.getState().loginWithBrokeredSso({ departmentToken: discovery.config!.departmentToken! });
      expect(signedIn()).toBe(true);
      expect(await thisAppsSession(user)).toEqual([expect.objectContaining({ authentication: 'OidcSso', loginMfa: null })]);
    });

    it("4. signs in through the broker on the provider's MFA, with no Resgrid prompt though the member has an authenticator", async () => {
      const user = await newUser({ sso: true, providerMfa: true, totp: true, requireMfa: true });
      await control('idp/next', { subject: user.externalSubject, amr: ['pwd', 'mfa'] });

      await useAuthStore.getState().loginWithBrokeredSso({ departmentToken: user.departmentToken });
      expect(useAuthStore.getState().mfaChallenge).toBeNull();
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].loginMfa).toBe('federated');
    });

    it('5. signs in through the broker, then with an authenticator code', async () => {
      const user = await newUser({ sso: true, totp: true });
      await control('idp/next', { subject: user.externalSubject });

      await useAuthStore.getState().loginWithBrokeredSso({ departmentToken: user.departmentToken });
      expect(useAuthStore.getState().status).toBe('mfaRequired');
      expect(useAuthStore.getState().mfaChallenge).toEqual(expect.objectContaining({ kind: 'verify', source: 'sso' }));

      expect(await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: await totp(user) })).toEqual(expect.objectContaining({ ok: true }));
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0]).toEqual(expect.objectContaining({ authentication: 'OidcSso', loginMfa: 'totp' }));
    });

    it("6. finishes a password sign-in with this app's passkey, which then counts as the session's recent MFA", async () => {
      const user = await newUser({ totp: true, passkeyFor: [CLIENT] });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      expect(useAuthStore.getState().mfaChallenge?.methods).toContain('passkey');
      expect(useAuthStore.getState().mfaChallenge?.enrolled).toContain('passkey');

      expect(await useAuthStore.getState().verifyLoginMfa({ method: 'passkey' })).toEqual(expect.objectContaining({ ok: true }));
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].loginMfa).toBe('passkey');

      // An account change right after sign-in takes the sign-in's own MFA: no password again, no step-up.
      await expect(getPasskeyRegistrationOptions()).resolves.toEqual(expect.objectContaining({ RequestId: expect.any(String) }));
      // So does protected data: the grant stands on the sign-in's passkey, and no prompt comes.
      const grant = await requestProtectedGrant();
      expect(grantClaims(grant.GrantToken as string)).toEqual(expect.objectContaining({ mfa_method: 'passkey', grant_ver: 2 }));
    });

    it('7. steps up for protected data with the passkey, where the department does not reuse the sign-in', async () => {
      const user = await newUser({ totp: true, passkeyFor: [CLIENT], acceptRecentLoginMfaForAdp: false });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: await totp(user) });
      await expect(requestProtectedGrant()).rejects.toMatchObject({ response: expect.objectContaining({ status: 401 }) });

      expect((await getStepUpMethods()).Methods).toContain('passkey');
      const ceremony = await getStepUpPasskeyOptions();
      const credential = await getPasskeyAssertion(ceremony.Options);
      const grant = await verifyStepUpPasskey(ceremony.RequestId, credential);
      expect(grantClaims(grant.GrantToken as string)).toEqual(expect.objectContaining({ mfa_method: 'passkey' }));
    });

    it('7. steps up inside a session with the passkey', async () => {
      const user = await newUser({ totp: true, passkeyFor: [CLIENT] });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: await totp(user) });
      expect(signedIn()).toBe(true);

      const options = await getStepUpOptions('account_security');
      expect(options.Methods).toContain('passkey');
      const credential = await getPasskeyAssertion(options.Passkey!.Options);
      await expect(verifyStepUp({ Operation: 'account_security', Method: 'passkey', RequestId: options.Passkey!.RequestId, Credential: credential })).resolves.toEqual(
        expect.objectContaining({ VerifiedAt: expect.any(String) })
      );
    });

    it("7. unlocks a locked shared tablet with the operator's passkey", async () => {
      saveSharedInstallation({ shared: true, label: 'Engine 7 tablet' });
      const user = await newUser({ totp: true, passkeyFor: [CLIENT] });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      await useAuthStore.getState().verifyLoginMfa({ method: 'passkey' });
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0].sharedMode).toBe(true);

      const locked = await lockSession();
      const unlock = await getUnlockOptions(locked.LockVersion);
      expect(unlock.Methods).toContain('passkey');
      const credential = await getPasskeyAssertion(unlock.Passkey!.Options);
      const unlocked = await completeUnlock(locked.LockVersion, { Method: 'passkey', RequestId: unlock.Passkey!.RequestId, Credential: credential });
      expect(unlocked.Locked).toBe(false);
    });

    it.each([false, true])("8. finishes a sign-in with the member's Responder approving on their phone (shared tablet: %s)", async (shared) => {
      saveSharedInstallation({ shared, label: shared ? 'Engine 7 tablet' : null });
      const user = await newUser({ totp: true, responderApprover: true });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      expect(useAuthStore.getState().mfaChallenge?.enrolled).toContain('passkey_approval');

      const started = await useAuthStore.getState().requestLoginApproval();
      if (!('ApprovalRequestId' in started)) {
        throw new Error('approval not started: ' + started.code);
      }
      // The member reads the number on this screen and approves on their phone.
      expect(await control<{ state: string }>('responder/approve', { userId: user.userId, matchNumber: started.MatchNumber })).toEqual({ state: 'approved' });

      expect(await useAuthStore.getState().waitForLoginApproval(started.ApprovalRequestId)).toBe('approved');
      expect(await useAuthStore.getState().verifyLoginMfa({ method: 'passkey_approval', approvalRequestId: started.ApprovalRequestId })).toEqual(expect.objectContaining({ ok: true }));
      expect(signedIn()).toBe(true);
      expect((await thisAppsSession(user))[0]).toEqual(expect.objectContaining({ loginMfa: 'passkey_approval', sharedMode: shared }));
    });

    it("8. unlocks a locked shared tablet with the operator's Responder", async () => {
      saveSharedInstallation({ shared: true, label: 'Engine 7 tablet' });
      const user = await newUser({ totp: true, responderApprover: true });
      await useAuthStore.getState().login({ username: user.username, password: user.password });
      await useAuthStore.getState().verifyLoginMfa({ method: 'totp', code: await totp(user) });
      expect(signedIn()).toBe(true);

      const locked = await lockSession();
      const requested = await requestUnlockApproval(locked.LockVersion);
      expect(await control<{ state: string }>('responder/approve', { userId: user.userId, matchNumber: requested.MatchNumber })).toEqual({ state: 'approved' });
      expect((await getUnlockApprovalStatus(requested.ApprovalRequestId)).State).toBe('approved');

      const unlocked = await completeUnlock(locked.LockVersion, { Method: 'passkey_approval', ApprovalRequestId: requested.ApprovalRequestId });
      expect(unlocked.Locked).toBe(false);
    });
  });
});
