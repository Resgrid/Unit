/**
 * CountlyConfig shim for web platform.
 * Provides a no-op CountlyConfig constructor so that
 *   import CountlyConfig from 'countly-sdk-react-native-bridge/CountlyConfig'
 * resolves correctly when metro redirects the subpath on web.
 */

class CountlyConfig {
  constructor(_serverURL?: string, _appKey?: string) {}
  enableCrashReporting() {
    return this;
  }
  setRequiresConsent(_v: boolean) {
    return this;
  }
  setLoggingEnabled(_v: boolean) {
    return this;
  }
  setDeviceId(_id: string) {
    return this;
  }
  setParameterTamperingProtectionSalt(_salt: string) {
    return this;
  }
}

export default CountlyConfig;
