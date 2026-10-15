import * as Notifications from 'expo-notifications';

import { registerUnitDevice, unRegisterNativePush } from '@/api/devices/push';
import { runSignOutHooks } from '@/lib/auth/sign-out-hooks';
import { logger } from '@/lib/logging';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((options: { ios?: unknown; default?: unknown }) => options.ios ?? options.default),
  },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ data: 'native-token' })),
  setBadgeCountAsync: jest.fn(() => Promise.resolve(true)),
  dismissAllNotificationsAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(() => Promise.resolve()),
    deleteChannel: jest.fn(() => Promise.resolve()),
    setNotificationCategories: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    cancelAllNotifications: jest.fn(() => Promise.resolve()),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidVisibility: { PUBLIC: 1 },
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 2 },
  EventType: { PRESS: 1, ACTION_PRESS: 2 },
}));

jest.mock('@/stores/auth/store', () => {
  const state = { status: 'signedIn', accessToken: 'access-token' };
  const store = Object.assign(
    jest.fn((selector?: (current: typeof state) => unknown) => (selector ? selector(state) : state)),
    { getState: () => state }
  );
  return { __esModule: true, default: store };
});

jest.mock('@/stores/push-notification/store', () => ({
  isSafeRouteId: jest.fn(() => true),
  parseNotificationData: jest.fn(() => ({ type: 'unknown' })),
  usePushNotificationModalStore: { getState: jest.fn(() => ({ showNotificationModal: jest.fn() })) },
}));

jest.mock('@/stores/app/core-store', () => ({ useCoreStore: { getState: jest.fn(() => ({})) } }));

jest.mock('@/stores/app/location-store', () => ({ useLocationStore: { getState: jest.fn(() => ({})) } }));

jest.mock('@/stores/check-in-timers/store', () => ({ useCheckInTimerStore: { getState: jest.fn(() => ({ performCheckIn: jest.fn() })) } }));

jest.mock('@/stores/security/store', () => ({ securityStore: jest.fn(() => null) }));

jest.mock('@/lib/navigation', () => ({ routerPushWithRetry: jest.fn(() => Promise.resolve()) }));

jest.mock('@/lib/storage/notification-prefs', () => ({
  getModernNotificationSoundsEnabled: jest.fn(() => true),
  getAppliedNotificationSoundMode: jest.fn(() => undefined),
  setAppliedNotificationSoundMode: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

jest.mock('@/lib/mfa/client-app', () => ({ CLIENT_HEADER: 'X-Resgrid-Client', RESGRID_CLIENT: 'unit' }));

jest.mock('@/lib/storage/app', () => ({
  getOrCreateDeviceUuid: jest.fn(() => 'device-uuid'),
  getBaseApiUrl: jest.fn(() => 'https://api.example/api/v4'),
}));

jest.mock('@/api/devices/push', () => ({
  registerUnitDevice: jest.fn(() => Promise.resolve({ Status: 'queued' })),
  unRegisterNativePush: jest.fn(() => Promise.resolve({ Status: 'success' })),
}));

describe('push notification sign-out', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let pushNotificationService: {
    registerForPushNotifications: (unitId: string, code: string) => Promise<string | null>;
    unregisterFromPushNotifications: () => Promise<void>;
  };

  beforeAll(() => {
    ({ pushNotificationService } = require('../push-notification'));
  });

  beforeEach(async () => {
    fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    // Start every test from a clean slate: nothing registered.
    await runSignOutHooks(null);
    fetchMock.mockClear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('takes the registered token off the unit as the signing-out session', async () => {
    await pushNotificationService.registerForPushNotifications('42', 'DEPT');
    expect(registerUnitDevice).toHaveBeenCalledWith(expect.objectContaining({ UnitId: '42', Token: 'native-token', Prefix: 'DEPT' }));

    await runSignOutHooks('access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example/api/v4/Devices/UnRegisterNativePush');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(expect.objectContaining({ 'Content-Type': 'application/json', Authorization: 'Bearer access-token', 'X-Resgrid-Client': 'unit' }));
    expect(JSON.parse(init.body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', UnitId: '42' });
  });

  it('does not call the server when the phone never registered', async () => {
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('unregisters only once per registration', async () => {
    await pushNotificationService.registerForPushNotifications('42', 'DEPT');

    await runSignOutHooks('access-token');
    await runSignOutHooks('access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call the server without an access token', async () => {
    await pushNotificationService.registerForPushNotifications('42', 'DEPT');

    await runSignOutHooks(null);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets sign-out carry on when the server refuses or is unreachable', async () => {
    await pushNotificationService.registerForPushNotifications('42', 'DEPT');
    fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 400 }));
    await expect(runSignOutHooks('access-token')).resolves.toBeUndefined();

    await pushNotificationService.registerForPushNotifications('42', 'DEPT');
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(runSignOutHooks('access-token')).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('does not remember a registration the server never accepted', async () => {
    (registerUnitDevice as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    await pushNotificationService.registerForPushNotifications('42', 'DEPT');
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not register a token when permission is refused, so there is nothing to unregister', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

    await pushNotificationService.registerForPushNotifications('42', 'DEPT');
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forgets the registration when the local push state is reset', async () => {
    await pushNotificationService.registerForPushNotifications('42', 'DEPT');

    await pushNotificationService.unregisterFromPushNotifications();
    await runSignOutHooks('access-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('signing out while a registration is in flight', () => {
    const settle = async (condition: () => boolean) => {
      for (let i = 0; i < 100 && !condition(); i++) {
        await Promise.resolve();
      }
    };

    it('takes a registration that lands after sign-out off as the signed-out session, and never restores it', async () => {
      let resolveRegistration: (value: { Status: string }) => void = () => {};
      (registerUnitDevice as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => (resolveRegistration = resolve)));

      const registering = pushNotificationService.registerForPushNotifications('42', 'DEPT');
      await settle(() => (registerUnitDevice as jest.Mock).mock.calls.length > 0);

      await runSignOutHooks('signed-out-token');
      expect(fetchMock).not.toHaveBeenCalled();

      resolveRegistration({ Status: 'queued' });
      await expect(registering).resolves.toBeNull();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.example/api/v4/Devices/UnRegisterNativePush');
      expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer signed-out-token' }));
      expect(JSON.parse(init.body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', UnitId: '42' });

      // Not restored: the next sign-out has nothing to take off.
      fetchMock.mockClear();
      await runSignOutHooks('access-token');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('warns when a registration lands after a sign-out that had no access token', async () => {
      let resolveRegistration: (value: { Status: string }) => void = () => {};
      (registerUnitDevice as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => (resolveRegistration = resolve)));

      const registering = pushNotificationService.registerForPushNotifications('42', 'DEPT');
      await settle(() => (registerUnitDevice as jest.Mock).mock.calls.length > 0);

      await runSignOutHooks(null);
      resolveRegistration({ Status: 'queued' });

      await expect(registering).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Push: a registration that landed after sign-out could not be taken off' }));
    });

    it('does not register at all when sign-out comes before the request is sent', async () => {
      let resolveToken: (value: { data: string }) => void = () => {};
      (Notifications.getDevicePushTokenAsync as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => (resolveToken = resolve)));

      const registering = pushNotificationService.registerForPushNotifications('42', 'DEPT');
      await settle(() => (Notifications.getDevicePushTokenAsync as jest.Mock).mock.calls.length > 0);

      await runSignOutHooks('access-token');
      resolveToken({ data: 'native-token' });

      await expect(registering).resolves.toBeNull();
      expect(registerUnitDevice).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('switching units', () => {
    it('takes the token off the unit the phone left, after the new unit is registered', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      await pushNotificationService.registerForPushNotifications('43', 'DEPT');

      expect(unRegisterNativePush).toHaveBeenCalledTimes(1);
      expect(unRegisterNativePush).toHaveBeenCalledWith({ Token: 'native-token', Prefix: 'DEPT', UnitId: '42' });
      const registeredNew = (registerUnitDevice as jest.Mock).mock.invocationCallOrder[1];
      const removedOld = (unRegisterNativePush as jest.Mock).mock.invocationCallOrder[0];
      expect(registeredNew).toBeLessThan(removedOld);

      // Sign-out then takes the token off the unit the phone is on now.
      await runSignOutHooks('access-token');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', UnitId: '43' });
    });

    it('leaves the unit alone when the same unit registers again', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');

      expect(unRegisterNativePush).not.toHaveBeenCalled();
    });

    it('takes the token off the old department when the unit moves to another one', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      await pushNotificationService.registerForPushNotifications('42', 'OTHER');

      expect(unRegisterNativePush).toHaveBeenCalledWith({ Token: 'native-token', Prefix: 'DEPT', UnitId: '42' });
    });

    it('keeps the old unit when the new unit could not be registered', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      (registerUnitDevice as jest.Mock).mockRejectedValueOnce(new Error('offline'));

      await pushNotificationService.registerForPushNotifications('43', 'DEPT');

      expect(unRegisterNativePush).not.toHaveBeenCalled();
      await runSignOutHooks('access-token');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', UnitId: '42' });
    });

    it('keeps the new registration when the old unit could not be cleared, and takes both off at sign-out', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      (unRegisterNativePush as jest.Mock).mockRejectedValueOnce(new Error('offline'));

      await expect(pushNotificationService.registerForPushNotifications('43', 'DEPT')).resolves.toBe('native-token');

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Push: the token could not be unregistered from the previous unit' }));
      await runSignOutHooks('access-token');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', UnitId: '43' });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', UnitId: '42' });
    });

    it('retries an old unit the server did not clear on the next registration', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      (unRegisterNativePush as jest.Mock).mockResolvedValueOnce({ Status: 'failure' });
      await pushNotificationService.registerForPushNotifications('43', 'DEPT');

      await pushNotificationService.registerForPushNotifications('44', 'DEPT');

      // 42 failed, then 42 (retried) and 43 both cleared.
      expect((unRegisterNativePush as jest.Mock).mock.calls.map(([input]) => input.UnitId)).toEqual(['42', '42', '43']);

      // Nothing left pending: sign-out only takes the current unit off.
      await runSignOutHooks('access-token');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ Token: 'native-token', Prefix: 'DEPT', UnitId: '44' });
    });

    it('does not take the token off a pending old unit the phone has come back to', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      (unRegisterNativePush as jest.Mock).mockRejectedValueOnce(new Error('offline'));
      await pushNotificationService.registerForPushNotifications('43', 'DEPT');
      (unRegisterNativePush as jest.Mock).mockClear();

      await pushNotificationService.registerForPushNotifications('42', 'DEPT');

      expect(unRegisterNativePush).toHaveBeenCalledTimes(1);
      expect(unRegisterNativePush).toHaveBeenCalledWith({ Token: 'native-token', Prefix: 'DEPT', UnitId: '43' });
    });

    it('warns when the server reports it could not clear the old unit', async () => {
      await pushNotificationService.registerForPushNotifications('42', 'DEPT');
      (unRegisterNativePush as jest.Mock).mockResolvedValueOnce({ Status: 'failure' });

      await pushNotificationService.registerForPushNotifications('43', 'DEPT');

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Push: the server did not unregister the token from the previous unit' }));
    });
  });
});
