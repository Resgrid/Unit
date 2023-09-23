import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.resgrid.unit',
  appName: 'Resgrid Unit',
  webDir: 'www',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
  },
  server: {
    allowNavigation: [],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchAutoHide: false
    },
    Badge: {
      persist: false,
      autoClear: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
