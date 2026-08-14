// Tests for the usePushNotifications hook. Kept in its own file because the
// hook needs @testing-library/react-native, while push-notification.test.ts
// exercises the service through a bare-module import.

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj: any) => obj.ios ?? obj.default),
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  osName: 'iOS',
  osVersion: '15.0',
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-device-token' })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(() => Promise.resolve()),
    deleteChannel: jest.fn(() => Promise.resolve()),
    setNotificationCategories: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    displayNotification: jest.fn(() => Promise.resolve('notification-id')),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidVisibility: { PUBLIC: 1 },
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 2 },
  EventType: { PRESS: 1, ACTION_PRESS: 2 },
}));

jest.mock('@/lib/navigation', () => ({
  routerPushWithRetry: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getDeviceUuid: jest.fn(() => 'test-device-uuid'),
}));

jest.mock('@/lib/storage/notification-prefs', () => ({
  getModernNotificationSoundsEnabled: jest.fn(() => true),
  getAppliedNotificationSoundMode: jest.fn(() => undefined),
  setAppliedNotificationSoundMode: jest.fn(),
}));

jest.mock('@/api/devices/push', () => ({
  registerUnitDevice: jest.fn(),
}));

jest.mock('@/stores/push-notification/store', () => ({
  usePushNotificationModalStore: {
    getState: jest.fn(() => ({ showNotificationModal: jest.fn() })),
  },
}));

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: {
    getState: jest.fn(() => ({ performCheckIn: jest.fn() })),
  },
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    getState: jest.fn(() => ({ latitude: null, longitude: null })),
  },
}));

// The three stores the hook actually gates on. Each keeps mutable state plus a
// __setState helper so a test can model hydration order (persisted unit/rights
// available before auth has settled).
jest.mock('@/stores/app/core-store', () => {
  const state: any = { activeUnitId: 'test-unit' };
  return {
    useCoreStore: Object.assign((selector: any) => (selector ? selector(state) : state), {
      __setState: (next: any) => Object.assign(state, next),
    }),
  };
});

jest.mock('@/stores/security/store', () => {
  const state: any = { rights: { DepartmentCode: 'TEST' } };
  return {
    securityStore: Object.assign((selector: any) => (selector ? selector(state) : state), {
      __setState: (next: any) => Object.assign(state, next),
    }),
  };
});

jest.mock('@/stores/auth/store', () => {
  const state: any = { status: 'signedIn', accessToken: 'test-access-token' };
  const store: any = (selector: any) => (selector ? selector(state) : state);
  store.getState = () => state;
  store.__setState = (next: any) => Object.assign(state, next);
  return { __esModule: true, default: store };
});

import { renderHook, waitFor } from '@testing-library/react-native';

import { logger } from '@/lib/logging';
import { useCoreStore } from '@/stores/app/core-store';
import useAuthStore from '@/stores/auth/store';
import { securityStore } from '@/stores/security/store';

import { pushNotificationService, usePushNotifications } from '../push-notification';

const setAuthState = (next: { status?: string; accessToken?: string | null }) => (useAuthStore as unknown as { __setState: (n: unknown) => void }).__setState(next);
const setCoreState = (next: { activeUnitId?: string | null }) => (useCoreStore as unknown as { __setState: (n: unknown) => void }).__setState(next);
const setSecurityState = (next: { rights: unknown }) => (securityStore as unknown as { __setState: (n: unknown) => void }).__setState(next);

describe('usePushNotifications', () => {
  let registerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthState({ status: 'signedIn', accessToken: 'test-access-token' });
    setCoreState({ activeUnitId: 'test-unit' });
    setSecurityState({ rights: { DepartmentCode: 'TEST' } });
    registerSpy = jest.spyOn(pushNotificationService, 'registerForPushNotifications').mockResolvedValue('test-device-token');
  });

  afterEach(() => {
    registerSpy.mockRestore();
  });

  it('registers when the user is signed in and a unit is active', async () => {
    const { unmount } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith('test-unit', 'TEST');
    });

    unmount();
  });

  it('does not register while auth has not settled, even with a persisted unit and rights', async () => {
    // Cold background start: MMKV-persisted unit/rights hydrate immediately
    // while the auth store is still 'idle'. Registering here would send a
    // stale token, 401, and force a refresh that can log the user out.
    setAuthState({ status: 'idle' });

    const { unmount } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(registerSpy).not.toHaveBeenCalled();
    });

    unmount();
  });

  it('does not register when signed in but no access token is present', async () => {
    setAuthState({ status: 'signedIn', accessToken: null });

    const { unmount } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(registerSpy).not.toHaveBeenCalled();
    });

    unmount();
  });

  it('registers once auth transitions to signed in', async () => {
    setAuthState({ status: 'loading', accessToken: null });

    const { rerender, unmount } = renderHook(() => usePushNotifications());

    expect(registerSpy).not.toHaveBeenCalled();

    setAuthState({ status: 'signedIn', accessToken: 'test-access-token' });
    rerender({});

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith('test-unit', 'TEST');
    });

    unmount();
  });

  it('does not register again for the same unit after a successful registration', async () => {
    const { rerender, unmount } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledTimes(1);
    });

    // New rights object identity re-runs the effect; the unit is unchanged and
    // already registered, so no second call.
    setSecurityState({ rights: { DepartmentCode: 'TEST' } });
    rerender({});

    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ message: 'Successfully registered for push notifications' }));
    });
    expect(registerSpy).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('retries on the next effect run when registration failed', async () => {
    // registerForPushNotifications swallows its errors and resolves null, so a
    // transient failure must not mark the unit as registered — otherwise push
    // stays dead for the rest of the app session.
    registerSpy.mockResolvedValueOnce(null);

    const { rerender, unmount } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledTimes(1);
    });

    setSecurityState({ rights: { DepartmentCode: 'TEST' } });
    rerender({});

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledTimes(2);
    });

    unmount();
  });

  it('logs an error when the registration promise rejects', async () => {
    registerSpy.mockRejectedValueOnce(new Error('boom'));

    const { unmount } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Error in push notification registration hook' }));
    });

    unmount();
  });
});
