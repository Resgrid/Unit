/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';

import { ClientEnv, Env } from './env';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: Env.NAME,
  description: `${Env.NAME} Resgrid Unit`,
  owner: Env.EXPO_ACCOUNT_OWNER,
  scheme: Env.SCHEME,
  slug: 'resgrid-unit',
  version: Env.VERSION.toString(),
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: Env.BUNDLE_ID,
    requireFullScreen: true,
    infoPlist: {
      UIBackgroundModes: ['remote-notification', 'audio'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  experiments: {
    typedRoutes: true,
  },
  android: {
    versionCode: Env.ANDROID_VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2E3C4B',
    },
    softwareKeyboardLayoutMode: 'pan',
    package: Env.PACKAGE,
    googleServicesFile: 'google-services.json',
    permissions: ['WAKE_LOCK', 'RECORD_AUDIO', 'FOREGROUND_SERVICE_MICROPHONE', 'POST_NOTIFICATIONS', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_CONNECTED_DEVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK'],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2E3C4B',
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
      'expo-notifications',
      {
        icon: './assets/adaptive-icon.png',
        color: '#2E3C4B',
        permissions: {
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        },
        sounds: [
          'assets/audio/notification.wav',
          'assets/audio/callclosed.wav',
          'assets/audio/callupdated.wav',
          'assets/audio/callemergency.wav',
          'assets/audio/callhigh.wav',
          'assets/audio/calllow.wav',
          'assets/audio/callmedium.wav',
          'assets/audio/newcall.wav',
          'assets/audio/newchat.wav',
          'assets/audio/newmessage.wav',
          'assets/audio/newshift.wav',
          'assets/audio/newtraining.wav',
          'assets/audio/personnelstaffingupdated.wav',
          'assets/audio/personnelstatusupdated.wav',
          'assets/audio/troublealert.wav',
          'assets/audio/unitnotice.wav',
          'assets/audio/unitstatusupdated.wav',
          'assets/audio/upcomingshift.wav',
          'assets/audio/upcomingtraining.wav',
          'assets/audio/custom/c1.wav',
          'assets/audio/custom/c2.wav',
          'assets/audio/custom/c3.wav',
          'assets/audio/custom/c4.wav',
          'assets/audio/custom/c5.wav',
          'assets/audio/custom/c6.wav',
          'assets/audio/custom/c7.wav',
          'assets/audio/custom/c8.wav',
          'assets/audio/custom/c9.wav',
          'assets/audio/custom/c10.wav',
          'assets/audio/custom/c11.wav',
          'assets/audio/custom/c12.wav',
          'assets/audio/custom/c13.wav',
          'assets/audio/custom/c14.wav',
          'assets/audio/custom/c15.wav',
          'assets/audio/custom/c16.wav',
          'assets/audio/custom/c17.wav',
          'assets/audio/custom/c18.wav',
          'assets/audio/custom/c19.wav',
          'assets/audio/custom/c20.wav',
          'assets/audio/custom/c21.wav',
          'assets/audio/custom/c22.wav',
          'assets/audio/custom/c23.wav',
          'assets/audio/custom/c24.wav',
          'assets/audio/custom/c25.wav',
        ],
        requestPermissions: true,
      },
    ],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsVersion: '11.8.0',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Resgird Unit to show current location on map.',
        locationAlwaysAndWhenInUsePermission: 'Allow Resgrid Unit to use your location.',
        locationAlwaysPermission: 'Resgrid Unit needs to track your location',
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
      'react-native-ble-plx',
      {
        isBackgroundEnabled: true,
        modes: ['peripheral', 'central'],
        bluetoothAlwaysPermission: 'Allow Resgrid Unit to connect to bluetooth devices',
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
    'expo-audio',
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    './customGradle.plugin.js',
    './customManifest.plugin.js',
  ],
  extra: {
    ...ClientEnv,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
    },
  },
});
