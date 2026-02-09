/**
 * Countly SDK shim for web platform.
 * Provides no-op implementations to prevent import errors.
 */

class CountlyConfig {
  constructor(_serverURL?: string, _appKey?: string) {}
  enableCrashReporting() { return this; }
  setRequiresConsent(_v: boolean) { return this; }
  setLoggingEnabled(_v: boolean) { return this; }
  setDeviceId(_id: string) { return this; }
  setParameterTamperingProtectionSalt(_salt: string) { return this; }
}

const Countly = {
  CountlyConfig,
  init: async () => {},
  initWithConfig: async (_config?: any) => {},
  start: async () => {},
  stop: async () => {},
  halt: async () => {},
  isInitialized: () => false,
  isLoggingEnabled: () => false,
  enableLogging: () => {},
  disableLogging: () => {},
  setLoggingEnabled: () => {},
  getCurrentDeviceId: async () => 'web-device-id',
  changeDeviceId: async () => {},
  setHttpPostForced: () => {},
  enableParameterTamperingProtection: () => {},
  setRequiresConsent: () => {},
  giveConsent: () => {},
  removeConsent: () => {},
  giveAllConsent: () => {},
  removeAllConsent: () => {},
  events: {
    recordEvent: () => {},
    startEvent: () => {},
    cancelEvent: () => {},
    endEvent: () => {},
  },
  views: {
    recordView: () => {},
    startAutoViewTracking: () => {},
    stopAutoViewTracking: () => {},
    startView: () => {},
    stopView: () => {},
    pauseView: () => {},
    resumeView: () => {},
  },
  crashes: {
    recordException: () => {},
    addBreadcrumb: () => {},
    setCustomCrashSegments: () => {},
  },
  userProfile: {
    setUserProperties: async () => {},
    setProperty: () => {},
    increment: () => {},
    incrementBy: () => {},
    multiply: () => {},
    saveMax: () => {},
    saveMin: () => {},
    setOnce: () => {},
    pushUnique: () => {},
    push: () => {},
    pull: () => {},
    save: () => {},
    clear: () => {},
  },
  feedback: {
    presentNPS: () => {},
    presentSurvey: () => {},
    presentRating: () => {},
  },
  setUserData: async () => {},
  setCustomUserData: async () => {},
  recordView: async () => {},
  setLocation: () => {},
  disableLocation: () => {},
  enableCrashReporting: () => {},
  logException: () => {},
  addCrashLog: () => {},
  recordDirectAttribution: () => {},
  recordIndirectAttribution: () => {},
};

export { CountlyConfig };
export default Countly;
