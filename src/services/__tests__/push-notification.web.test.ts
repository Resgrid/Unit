/**
 * Push on the web and desktop editions (services/push-notification.web.ts): a browser mints an FCM web token, a desktop
 * gets one from its main process, and either is registered on the active unit as Platform 3. A registration never
 * outlives its session: sign-out unregisters and kills the token, and another unit on the device rotates it first.
 */

const mockRegisterUnitDevice = jest.fn(async () => ({}));
const mockUnRegisterWebPush = jest.fn(async () => ({}));
const mockRouterPushWithRetry = jest.fn(async () => undefined);
const mockShowNotificationModal = jest.fn(async () => undefined);
const mockFirebaseGetToken = jest.fn(async () => 'browser-token');
const mockFirebaseDeleteToken = jest.fn(async () => true);

jest.mock('firebase/app', () => ({ getApps: () => [], initializeApp: (_config: unknown, name: string) => ({ name }) }));
jest.mock('firebase/messaging', () => ({
  isSupported: async () => true,
  getMessaging: () => 'messaging',
  getToken: (...args: unknown[]) => mockFirebaseGetToken(...(args as [])),
  deleteToken: (...args: unknown[]) => mockFirebaseDeleteToken(...(args as [])),
}));
jest.mock('@/api/devices/push', () => ({
  registerUnitDevice: (...args: unknown[]) => mockRegisterUnitDevice(...(args as [])),
  unRegisterWebPush: (...args: unknown[]) => mockUnRegisterWebPush(...(args as [])),
}));
jest.mock('@/lib/navigation', () => ({ routerPushWithRetry: (...args: unknown[]) => mockRouterPushWithRetry(...(args as [])) }));
jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: () => 'https://api.test/api/v4', getDeviceUuid: () => 'device-uuid' }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/mfa/client-app', () => ({ CLIENT_HEADER: 'X-Resgrid-Client', RESGRID_CLIENT: 'unit' }));
jest.mock('@/stores/push-notification/store', () => {
  const actual = jest.requireActual('@/stores/push-notification/store');
  return { ...actual, usePushNotificationModalStore: { getState: () => ({ showNotificationModal: mockShowNotificationModal }) } };
});
jest.mock('@/services/notification-sound.service', () => ({ notificationSoundService: { playNotificationSound: jest.fn() } }));

const mockState = {
  auth: { status: 'signedIn', accessToken: 'access-token' } as { status: string; accessToken: string | null },
  core: { activeUnitId: '12', config: null as Record<string, string> | null },
  security: { rights: { DepartmentCode: 'DEPT' } as { DepartmentCode: string } | null },
};

const mockStoreOf = (read: () => object) => Object.assign((selector: (value: object) => unknown) => selector(read()), { getState: read });
jest.mock('@/stores/auth/store', () => ({ __esModule: true, default: mockStoreOf(() => mockState.auth) }));
jest.mock('@/stores/app/core-store', () => ({ useCoreStore: mockStoreOf(() => mockState.core) }));
jest.mock('@/stores/security/store', () => ({ securityStore: mockStoreOf(() => mockState.security) }));

const firebaseConfig = {
  WebPushApiKey: 'api-key',
  WebPushAuthDomain: '',
  WebPushProjectId: 'resgrid-web',
  WebPushMessagingSenderId: '343968022249',
  WebPushAppId: '1:343968022249:web:abc',
  WebPushVapidKey: 'BVapid',
};

type Module = typeof import('../push-notification.web');
type Hooks = typeof import('@/lib/auth/sign-out-hooks');

const globals = globalThis as unknown as Record<string, unknown>;
let storage: Map<string, string>;
let worker: { scriptURL: string; postMessage: jest.Mock };
let serviceWorkerListeners: ((event: { data: unknown }) => void)[];
let permission: NotificationPermission;
let requestPermission: jest.Mock;
let clickListeners: Set<() => void>;

/** A click anywhere on the page, as the person would make one. */
const clickPage = () => [...clickListeners].forEach((listener) => listener());

/** Lets every promise already settled run its callbacks. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Holds the next FCM token mint; the returned wait resolves, once a sync has reached it, to what releases it. */
function holdNextMint(): () => Promise<(token: string) => void> {
  const held: { release?: (token: string) => void } = {};
  mockFirebaseGetToken.mockImplementationOnce(() => new Promise<string>((resolve) => (held.release = resolve)));
  return async () => {
    while (!held.release) {
      await flush();
    }
    return held.release;
  };
}

function installBrowser() {
  storage = new Map();
  worker = { scriptURL: 'https://unit.test/service-worker.js', postMessage: jest.fn() };
  serviceWorkerListeners = [];
  permission = 'default';
  requestPermission = jest.fn(async () => permission);

  const registration = { active: worker, pushManager: { getSubscription: async () => null } };
  globals.window = globalThis;
  globals.isSecureContext = true;
  globals.PushManager = function PushManager() {};
  globals.Notification = {
    get permission() {
      return permission;
    },
    requestPermission: () => requestPermission(),
  };
  globals.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  clickListeners = new Set();
  globals.document = {
    visibilityState: 'visible',
    hasFocus: () => true,
    addEventListener: (type: string, listener: () => void) => type === 'click' && clickListeners.add(listener),
    removeEventListener: (type: string, listener: () => void) => type === 'click' && clickListeners.delete(listener),
  };
  globals.electronAPI = undefined;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        controller: null,
        ready: Promise.resolve(registration),
        register: jest.fn(async () => registration),
        getRegistrations: jest.fn(async () => [registration]),
        addEventListener: (_type: string, listener: (event: { data: unknown }) => void) => serviceWorkerListeners.push(listener),
        removeEventListener: jest.fn(),
      },
    },
  });
}

function load(): { push: Module; hooks: Hooks } {
  let loaded!: { push: Module; hooks: Hooks };
  jest.isolateModules(() => {
    loaded = { push: require('../push-notification.web'), hooks: require('@/lib/auth/sign-out-hooks') };
  });
  return loaded;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState.auth = { status: 'signedIn', accessToken: 'access-token' };
  mockState.core = { activeUnitId: '12', config: { ...firebaseConfig } };
  mockState.security = { rights: { DepartmentCode: 'DEPT' } };
  installBrowser();
  globals.fetch = jest.fn(async () => ({ ok: true }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('browser', () => {
  it('registers nothing, and never asks, while Core has no Firebase web app configured', async () => {
    mockState.core.config = null;
    permission = 'granted';
    const { push } = load();

    await push.syncWebPush();
    push.askForPermissionOnce();
    clickPage();

    expect(mockRegisterUnitDevice).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('registers its FCM web token on the active unit as soon as the browser has permission, with no setting of its own', async () => {
    permission = 'granted';
    const { push } = load();

    await push.syncWebPush();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(mockFirebaseGetToken).toHaveBeenCalledWith('messaging', expect.objectContaining({ vapidKey: 'BVapid' }));
    expect(mockRegisterUnitDevice).toHaveBeenCalledWith({ UnitId: '12', Token: 'browser-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' }, expect.anything());
  });

  it('asks for permission once, on the first click after sign-in, then registers', async () => {
    requestPermission.mockImplementation(async () => (permission = 'granted'));
    const { push } = load();

    await push.syncWebPush();
    push.askForPermissionOnce();
    expect(mockRegisterUnitDevice).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();

    clickPage();
    await new Promise((resolve) => setImmediate(resolve));

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(mockRegisterUnitDevice).toHaveBeenCalledWith({ UnitId: '12', Token: 'browser-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' }, expect.anything());

    clickPage();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('waits a week before asking again after the prompt is dismissed', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { push } = load();

    push.askForPermissionOnce();
    clickPage();
    await new Promise((resolve) => setImmediate(resolve));
    expect(requestPermission).toHaveBeenCalledTimes(1);

    push.askForPermissionOnce();
    clickPage();
    expect(requestPermission).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 8 * 24 * 60 * 60 * 1000);
    push.askForPermissionOnce();
    clickPage();
    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(mockRegisterUnitDevice).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('neither asks nor registers once the person has blocked notifications', async () => {
    permission = 'denied';
    const { push } = load();

    await push.syncWebPush();
    push.askForPermissionOnce();
    clickPage();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(mockRegisterUnitDevice).not.toHaveBeenCalled();
  });

  it('re-registers an unchanged token only once a day', async () => {
    permission = 'granted';
    const { push } = load();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await push.syncWebPush();
    await push.syncWebPush();
    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 25 * 60 * 60 * 1000);
    await push.syncWebPush();
    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('takes the device off the previous unit and rotates the token before registering another', async () => {
    permission = 'granted';
    const { push } = load();
    await push.syncWebPush();
    mockFirebaseGetToken.mockResolvedValue('rotated-token');

    mockState.core.activeUnitId = '15';
    await push.syncWebPush();

    expect(mockUnRegisterWebPush).toHaveBeenCalledWith({ Token: 'browser-token', Prefix: 'DEPT', UnitId: '12' }, expect.anything());
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterUnitDevice).toHaveBeenLastCalledWith({ UnitId: '15', Token: 'rotated-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' }, expect.anything());
    mockFirebaseGetToken.mockResolvedValue('browser-token');
  });

  it('unregisters straight to the server and kills the token at sign-out, while the session still works', async () => {
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();

    await hooks.runSignOutHooks('access-token');

    expect(globals.fetch).toHaveBeenCalledWith('https://api.test/api/v4/Devices/UnRegisterWebPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer access-token', 'X-Resgrid-Client': 'unit' },
      body: JSON.stringify({ Token: 'browser-token', Prefix: 'DEPT', UnitId: '12' }),
      signal: expect.anything(),
    });
    expect(mockUnRegisterWebPush).not.toHaveBeenCalled();
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
  });

  it('still kills the token when the sign-out call fails', async () => {
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();
    (globals.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await hooks.runSignOutHooks('access-token');

    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
  });

  it('takes off the registration a sync in flight at sign-out was still writing', async () => {
    permission = 'granted';
    const { push, hooks } = load();
    const reachedMint = holdNextMint();

    const sync = push.syncWebPush();
    const releaseToken = await reachedMint();
    const signOut = hooks.runSignOutHooks('access-token');
    releaseToken('browser-token');
    await Promise.all([sync, signOut]);

    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(1);
    expect(globals.fetch).toHaveBeenCalledWith('https://api.test/api/v4/Devices/UnRegisterWebPush', expect.objectContaining({ body: JSON.stringify({ Token: 'browser-token', Prefix: 'DEPT', UnitId: '12' }) }));
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(push.pushNotificationService.getPushToken()).toBeNull();
  });

  it('registers nothing for a session that ended while its token was minted', async () => {
    permission = 'granted';
    const { push } = load();
    const reachedMint = holdNextMint();

    const sync = push.syncWebPush();
    const releaseToken = await reachedMint();
    mockState.auth = { status: 'signedOut', accessToken: null };
    releaseToken('browser-token');
    await sync;

    expect(mockRegisterUnitDevice).not.toHaveBeenCalled();
    expect(push.pushNotificationService.getPushToken()).toBeNull();
  });

  it('releases a hung token mint so sign-out removes the old registration and the next sign-in can sync', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();
    const reachedMint = holdNextMint();
    const sync = push.syncWebPush();
    const failedSync = expect(sync).rejects.toThrow('timed out');
    const releaseToken = await reachedMint();
    const signOut = hooks.runSignOutHooks('access-token');

    await jest.advanceTimersByTimeAsync(hooks.SIGN_OUT_HOOK_TIMEOUT_MS);
    await signOut;
    mockState.auth = { status: 'signedOut', accessToken: null };
    await jest.advanceTimersByTimeAsync(30_000);
    await failedSync;

    expect(push.pushNotificationService.getPushToken()).toBeNull();
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(globals.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify({ Token: 'browser-token', Prefix: 'DEPT', UnitId: '12' }) }));

    mockState.auth = { status: 'signedIn', accessToken: 'next-access-token' };
    mockState.core.activeUnitId = '15';
    mockFirebaseGetToken.mockResolvedValue('next-token');
    await push.syncWebPush();
    releaseToken('late-token');
    await flush();

    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(2);
    expect(mockRegisterUnitDevice).toHaveBeenLastCalledWith(expect.objectContaining({ UnitId: '15', Token: 'next-token' }), expect.anything());
    expect(push.pushNotificationService.getPushToken()).toBe('next-token');
    mockFirebaseGetToken.mockResolvedValue('browser-token');
  });

  it('does not mint a token when service-worker readiness arrives after its timeout', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();
    const held: { ready?: (registration: object) => void } = {};
    const registration = { active: null };
    (navigator.serviceWorker.register as jest.Mock).mockResolvedValueOnce(registration);
    Object.defineProperty(navigator.serviceWorker, 'ready', { value: new Promise((resolve) => (held.ready = resolve)), configurable: true });
    const sync = push.syncWebPush();
    const failedSync = expect(sync).rejects.toThrow('timed out');
    await flush();
    const signOut = hooks.runSignOutHooks('access-token');
    await jest.advanceTimersByTimeAsync(30_000);
    await Promise.all([failedSync, signOut]);
    const mints = mockFirebaseGetToken.mock.calls.length;

    held.ready?.(registration);
    await flush();

    expect(mockFirebaseGetToken).toHaveBeenCalledTimes(mints);
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(push.pushNotificationService.getPushToken()).toBeNull();
  });

  it('lets the next sign-in register only once a slow sign-out cleanup is done', async () => {
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();
    const server: { answer?: () => void } = {};
    (globals.fetch as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => (server.answer = () => resolve({ ok: true }))));

    const signOut = hooks.runSignOutHooks('access-token');
    mockState.core.activeUnitId = '15';
    const signIn = push.syncWebPush();
    await flush();
    await flush();

    expect(server.answer).toBeDefined();
    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(1);

    server.answer?.();
    await Promise.all([signOut, signIn]);

    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(2);
    expect(mockRegisterUnitDevice).toHaveBeenLastCalledWith(expect.objectContaining({ UnitId: '15' }), expect.anything());
    expect(mockFirebaseDeleteToken.mock.invocationCallOrder[0]).toBeLessThan(mockRegisterUnitDevice.mock.invocationCallOrder[1]);
  });

  it('aborts a hung device registration and leaves its token for sign-out to remove', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    permission = 'granted';
    const { push, hooks } = load();
    const held: { registration?: () => void } = {};
    mockRegisterUnitDevice.mockImplementationOnce(() => new Promise((resolve) => (held.registration = () => resolve({}))));
    const sync = push.syncWebPush();
    const failedSync = expect(sync).rejects.toThrow('timed out');
    await flush();
    const signal = (mockRegisterUnitDevice.mock.calls as unknown as [unknown, AbortSignal][])[0][1];
    const signOut = hooks.runSignOutHooks('access-token');
    await jest.advanceTimersByTimeAsync(30_000);
    await Promise.all([failedSync, signOut]);

    expect(signal.aborted).toBe(true);
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(globals.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify({ Token: 'browser-token', Prefix: 'DEPT', UnitId: '12' }) }));
    held.registration?.();
    await flush();
    expect(push.pushNotificationService.getPushToken()).toBeNull();
  });

  it('removes a registration if the unit changed while Core was accepting it', async () => {
    permission = 'granted';
    const { push } = load();
    mockRegisterUnitDevice.mockImplementationOnce(async () => {
      mockState.core.activeUnitId = '15';
      return {};
    });

    await push.syncWebPush();

    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(globals.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify({ Token: 'browser-token', Prefix: 'DEPT', UnitId: '12' }) }));
    expect(push.pushNotificationService.getPushToken()).toBeNull();
  });

  it('retries a failed registration instead of treating its cleanup record as a successful registration', async () => {
    permission = 'granted';
    const { push } = load();
    mockRegisterUnitDevice.mockRejectedValueOnce(new Error('offline'));

    await expect(push.syncWebPush()).rejects.toThrow('offline');
    await push.syncWebPush();

    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(2);
  });

  it('aborts a stalled sign-out request so the next session can register', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    permission = 'granted';
    const { push, hooks } = load();
    await push.syncWebPush();
    (globals.fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));
    const signOut = hooks.runSignOutHooks('access-token');
    await flush();
    const signal = (globals.fetch as jest.Mock).mock.calls[0][1].signal as AbortSignal;
    const signIn = push.syncWebPush();
    await jest.advanceTimersByTimeAsync(30_000);
    await Promise.all([signOut, signIn]);

    expect(signal.aborted).toBe(true);
    expect(mockFirebaseDeleteToken).toHaveBeenCalledTimes(1);
    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(2);
  });
});

describe('desktop', () => {
  let bridge: Record<string, jest.Mock>;

  beforeEach(() => {
    bridge = {
      pushStart: jest.fn(async () => ({ token: 'desktop-token' })),
      pushStop: jest.fn(async () => undefined),
      pushTakePendingClick: jest.fn(async () => null),
      onPushReceived: jest.fn(() => () => undefined),
      onPushNotificationClick: jest.fn(() => () => undefined),
    };
    globals.electronAPI = bridge;
  });

  it('registers the token its main process hands back, without asking (the OS handles permission)', async () => {
    const { push } = load();

    await push.syncWebPush();

    expect(bridge.pushStart).toHaveBeenCalledWith({ apiKey: 'api-key', authDomain: undefined, projectId: 'resgrid-web', messagingSenderId: '343968022249', appId: '1:343968022249:web:abc', vapidKey: 'BVapid' });
    expect(mockRegisterUnitDevice).toHaveBeenCalledWith({ UnitId: '12', Token: 'desktop-token', Platform: 3, DeviceUuid: 'device-uuid', Prefix: 'DEPT' }, expect.anything());
    push.askForPermissionOnce();
    clickPage();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('forgets its credentials at sign-out', async () => {
    const { push, hooks } = load();
    await push.syncWebPush();

    await hooks.runSignOutHooks('access-token');

    expect(bridge.pushStop).toHaveBeenCalledWith(true);
  });

  it('stops a hung desktop start after its timeout and ignores its late token', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    const { push, hooks } = load();
    await push.syncWebPush();
    const held: { start?: (result: { token: string }) => void } = {};
    bridge.pushStart.mockImplementationOnce(() => new Promise((resolve) => (held.start = resolve)));
    const sync = push.syncWebPush();
    const failedSync = expect(sync).rejects.toThrow('timed out');
    await flush();
    const signOut = hooks.runSignOutHooks('access-token');

    await jest.advanceTimersByTimeAsync(30_000);
    await Promise.all([failedSync, signOut]);
    expect(bridge.pushStop).toHaveBeenCalledWith(true);
    expect(push.pushNotificationService.getPushToken()).toBeNull();

    held.start?.({ token: 'late-desktop-token' });
    await flush();
    expect(mockRegisterUnitDevice).toHaveBeenCalledTimes(1);
  });

  it('registers nothing when the main process could not start', async () => {
    bridge.pushStart.mockResolvedValue({ error: 'PHONE_REGISTRATION_ERROR' });
    const { push } = load();

    await push.syncWebPush();

    expect(mockRegisterUnitDevice).not.toHaveBeenCalled();
  });

  it('routes a notification click the main process kept for the page', async () => {
    bridge.pushTakePendingClick.mockResolvedValue({ title: 'Fire', body: '', eventCode: 'C:42' });
    const { push } = load();

    push.attachWebPushListeners();
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '42' } }, expect.anything());
  });
});

describe('clicks and foreground pushes', () => {
  it('opens a call or a chat like a tap on the phone, and anything else as the in-app alert', async () => {
    const { push } = load();

    await push.openWebPush({ title: 'Fire', body: '', eventCode: 'C1234' });
    expect(mockRouterPushWithRetry).toHaveBeenLastCalledWith({ pathname: '/call/[id]', params: { id: '1234' } }, expect.anything());

    await push.openWebPush({ title: 'Chat', body: '', eventCode: 't:abc-123' });
    expect(mockRouterPushWithRetry).toHaveBeenLastCalledWith({ pathname: '/chat/[channelId]', params: { channelId: 'abc-123' } }, expect.anything());

    await push.openWebPush({ title: 'Message', body: 'Hello', eventCode: 'M:5' });
    expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'M:5', title: 'Message', body: 'Hello' }));
  });

  it('refuses an id that would steer the router elsewhere', async () => {
    const { push } = load();

    await push.openWebPush({ title: 'Fire', body: '', eventCode: 'C:../admin' });

    expect(mockRouterPushWithRetry).not.toHaveBeenCalled();
    expect(mockShowNotificationModal).toHaveBeenCalled();
  });

  it('falls back to the in-app alert when the route never lands', async () => {
    mockRouterPushWithRetry.mockRejectedValueOnce(new Error('not ready'));
    const { push } = load();

    await push.openWebPush({ title: 'Fire', body: '', eventCode: 'C:7' });

    expect(mockShowNotificationModal).toHaveBeenCalledWith(expect.objectContaining({ eventCode: 'C:7' }));
  });

  it('takes the service worker clicks and shows a push only to a page in front of the person', async () => {
    const { push } = load();
    push.attachWebPushListeners();
    await new Promise((resolve) => setImmediate(resolve));
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'CLIENT_READY' });

    serviceWorkerListeners.forEach((listener) => listener({ data: { type: 'NOTIFICATION_CLICK', data: { title: 'Fire', body: '', eventCode: 'C:9' } } }));
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockRouterPushWithRetry).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '9' } }, expect.anything());

    serviceWorkerListeners.forEach((listener) => listener({ data: { type: 'PUSH_RECEIVED', data: { title: 'Msg', body: '', eventCode: 'M:1' } } }));
    expect(mockShowNotificationModal).toHaveBeenCalledTimes(1);

    globals.document = { visibilityState: 'hidden', hasFocus: () => false };
    serviceWorkerListeners.forEach((listener) => listener({ data: { type: 'PUSH_RECEIVED', data: { title: 'Msg', body: '', eventCode: 'M:2' } } }));
    expect(mockShowNotificationModal).toHaveBeenCalledTimes(1);
  });
});
