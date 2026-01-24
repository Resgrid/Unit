/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import { ClientEnv, Env } from './env';
const packageJSON = require('./package.json');

const appIconBadgeConfig: AppIconBadgeConfig = {
  enabled: Env.APP_ENV !== 'production',
  badges: [
    {
      text: Env.APP_ENV,
      type: 'banner',
      color: 'white',
    },
    {
      text: Env.VERSION.toString(),
      type: 'ribbon',
      color: 'white',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: Env.NAME,
  description: `${Env.NAME} Resgrid Unit`,
  owner: Env.EXPO_ACCOUNT_OWNER,
  scheme: Env.SCHEME,
  slug: 'resgrid-unit',
  version: packageJSON.version,
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    icon: './assets/ios-icon.png',
    version: packageJSON.version,
    buildNumber: packageJSON.version,
    supportsTablet: true,
    bundleIdentifier: Env.BUNDLE_ID,
    requireFullScreen: true,
    googleServicesFile: 'GoogleService-Info.plist',
    infoPlist: {
      UIBackgroundModes: ['remote-notification', 'audio', 'bluetooth-central', 'voip'],
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: false,
      NSBluetoothAlwaysUsageDescription: 'Allow Resgrid Unit to connect to bluetooth devices for PTT.',
    },
    entitlements: {
      ...((Env.APP_ENV === 'production' || Env.APP_ENV === 'internal') && {
        'com.apple.developer.usernotifications.critical-alerts': true,
        'com.apple.developer.usernotifications.time-sensitive': true,
      }),
    },
  },
  experiments: {
    typedRoutes: true,
  },
  android: {
    version: packageJSON.version,
    versionCode: parseInt(packageJSON.versionCode),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2484c4',
    },
    softwareKeyboardLayoutMode: 'pan',
    package: Env.PACKAGE,
    googleServicesFile: 'google-services.json',
    permissions: [
      'android.permission.WAKE_LOCK',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAPTURE_AUDIO_OUTPUT',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2a7dd5',
        image: './assets/adaptive-icon.png',
        imageWidth: 250,
      },
    ],
    [
      'expo-font',
      {
        fonts: ['./assets/fonts/Inter.ttf'],
      },
    ],
    'expo-localization',
    'expo-router',
    ['react-native-edge-to-edge'],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsVersion: '11.8.0',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Resgrid Unit to show current location on map.',
        locationAlwaysAndWhenInUsePermission: 'Allow Resgrid Unit to use your location for department updates.',
        locationAlwaysPermission: 'Resgrid Unit needs to track your location for department AVL.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        taskManager: {
          locationTaskName: 'location-updates',
          locationTaskOptions: {
            accuracy: 'balanced',
            distanceInterval: 10,
            timeInterval: 5000,
          },
        },
      },
    ],
    [
      'expo-task-manager',
      {
        taskManager: {
          taskName: 'location-updates',
        },
      },
    ],
    [
      'expo-screen-orientation',
      {
        initialOrientation: 'DEFAULT',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          extraProguardRules: '-keep class expo.modules.location.** { *; }',
          extraMavenRepos: ['../../node_modules/@notifee/react-native/android/libs'],
          targetSdkVersion: 35,
        },
        ios: {
          deploymentTarget: '18.1',
          useFrameworks: 'static',
        },
      },
    ],
    [
      'expo-asset',
      {
        assets: [
          'assets/mapping',
          'assets/audio/ui/space_notification1.mp3',
          'assets/audio/ui/space_notification2.mp3',
          'assets/audio/ui/positive_interface_beep.mp3',
          'assets/audio/ui/software_interface_start.mp3',
          'assets/audio/ui/software_interface_back.mp3',
        ],
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'sentry',
        project: 'unit',
        url: 'https://sentry.resgrid.net/',
      },
    ],
    [
      'expo-navigation-bar',
      {
        position: 'relative',
        visibility: 'hidden',
        behavior: 'inset-touch',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Allow Resgrid Unit to access the microphone for audio input used in PTT and calls.',
      },
    ],
    'react-native-ble-manager',
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    '@config-plugins/react-native-callkeep',
    '@react-native-firebase/app',
    './customGradle.plugin.js',
    './customManifest.plugin.js',
    './plugins/withForegroundNotifications.js',
    './plugins/withNotificationSounds.js',
    './plugins/withMediaButtonModule.js',
    ['app-icon-badge', appIconBadgeConfig],
  ],
  extra: {
    ...ClientEnv,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
    },
  },
});
