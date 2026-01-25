/**
 * Web-safe shims for native modules that don't work on web platform.
 * These provide no-op implementations to prevent import errors.
 */

// Notifee shim
export const AndroidImportance = {
  DEFAULT: 'default',
  HIGH: 'high',
  LOW: 'low',
  MIN: 'min',
  NONE: 'none',
  UNSPECIFIED: 'unspecified',
};

export const AndroidVisibility = {
  PRIVATE: 'private',
  PUBLIC: 'public',
  SECRET: 'secret',
};

export const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

export const EventType = {
  DISMISSED: 0,
  PRESS: 1,
  ACTION_PRESS: 2,
  DELIVERED: 3,
  APP_BLOCKED: 4,
  CHANNEL_BLOCKED: 5,
  CHANNEL_GROUP_BLOCKED: 6,
  TRIGGER_NOTIFICATION_CREATED: 7,
};

export const notifee = {
  createChannel: async () => 'web-channel',
  displayNotification: async () => 'web-notification',
  setBadgeCount: async () => {},
  getBadgeCount: async () => 0,
  incrementBadgeCount: async () => {},
  decrementBadgeCount: async () => {},
  requestPermission: async () => ({ authorizationStatus: AuthorizationStatus.AUTHORIZED }),
  getPermissionSettings: async () => ({ authorizationStatus: AuthorizationStatus.AUTHORIZED }),
  onForegroundEvent: () => () => {},
  onBackgroundEvent: () => {},
  registerForegroundService: async () => {},
  stopForegroundService: async () => {},
  cancelNotification: async () => {},
  cancelAllNotifications: async () => {},
  getInitialNotification: async () => null,
  getDisplayedNotifications: async () => [],
  getTriggerNotifications: async () => [],
  setNotificationCategories: async () => {},
};

export default notifee;

// Firebase Messaging shim
export const messaging = () => ({
  getToken: async () => 'web-token',
  deleteToken: async () => {},
  hasPermission: async () => 1,
  requestPermission: async () => 1,
  onMessage: () => () => {},
  onNotificationOpenedApp: () => () => {},
  getInitialNotification: async () => null,
  setBackgroundMessageHandler: () => {},
  subscribeToTopic: async () => {},
  unsubscribeFromTopic: async () => {},
});

messaging.AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

// Firebase App shim
export const firebaseApp = {
  initializeApp: () => ({}),
  getApp: () => ({}),
  getApps: () => [],
};

// CallKeep shim
export const callKeepService = {
  startCall: async () => 'web-call-uuid',
  endCall: async () => {},
  setMuteStateCallback: () => {},
  initialize: async () => {},
  cleanup: () => {},
};

// RNCallKeep shim (for direct imports)
export const RNCallKeep = {
  setup: async () => {},
  hasDefaultPhoneAccount: async () => true,
  answerIncomingCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  endAllCalls: () => {},
  setMutedCall: () => {},
  checkIfBusy: async () => false,
  checkSpeaker: async () => false,
  setAvailable: () => {},
  setCurrentCallActive: () => {},
  displayIncomingCall: () => {},
  startCall: () => {},
  updateDisplay: () => {},
  reportConnectedOutgoingCallWithUUID: () => {},
  reportEndCallWithUUID: () => {},
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
  getAudioRoutes: async () => [],
  setAudioRoute: async () => {},
};

// BLE Manager shim
export const BleManager = {
  start: async () => {},
  scan: () => {},
  stopScan: () => {},
  connect: async () => {},
  disconnect: async () => {},
  read: async () => null,
  write: async () => {},
  retrieveServices: async () => ({}),
  startNotification: async () => {},
  stopNotification: async () => {},
  isPeripheralConnected: async () => false,
  getConnectedPeripherals: async () => [],
  getBondedPeripherals: async () => [],
  createBond: async () => {},
  removeBond: async () => {},
  enableBluetooth: async () => {},
  checkState: () => {},
};

// LiveKit React Native shim
export const registerGlobals = () => {
  // No-op on web - livekit-client handles WebRTC natively
};

export const RTCAudioSession = {
  configure: async () => {},
  setCategory: async () => {},
  setMode: async () => {},
  getActiveAudioSession: () => null,
  setActive: async () => {},
};

// Expo modules that may have issues on web
export const expoAudioShim = {
  getRecordingPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  requestRecordingPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
};
