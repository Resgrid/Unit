/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';
import type { AppIconBadgeConfig } from 'app-icon-badge/types';

import { ClientEnv, Env } from './env';

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
      UIBackgroundModes: ['remote-notification'],
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
    ['app-icon-badge', appIconBadgeConfig],
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
        ios: {
          sounds: [
            {
              name: 'callmedium',
              type: 'caf',
              target: './assets/audio/caf/callmedium.caf',
            },
            {
              name: 'calllow',
              type: 'caf',
              target: './assets/audio/caf/calllow.caf',
            },
            {
              name: 'callhigh',
              type: 'caf',
              target: './assets/audio/caf/callhigh.caf',
            },
            {
              name: 'callemergency',
              type: 'caf',
              target: './assets/audio/caf/callemergency.caf',
            },
            {
              name: 'c9',
              type: 'caf',
              target: './assets/audio/caf/c9.caf',
            },
            {
              name: 'c8',
              type: 'caf',
              target: './assets/audio/caf/c8.caf',
            },
            {
              name: 'c7',
              type: 'caf',
              target: './assets/audio/caf/c7.caf',
            },
            {
              name: 'c6',
              type: 'caf',
              target: './assets/audio/caf/c6.caf',
            },
            {
              name: 'c5',
              type: 'caf',
              target: './assets/audio/caf/c5.caf',
            },
            {
              name: 'c4',
              type: 'caf',
              target: './assets/audio/caf/c4.caf',
            },
            {
              name: 'c3',
              type: 'caf',
              target: './assets/audio/caf/c3.caf',
            },
            {
              name: 'c25',
              type: 'caf',
              target: './assets/audio/caf/c25.caf',
            },
            {
              name: 'c24',
              type: 'caf',
              target: './assets/audio/caf/c24.caf',
            },
            {
              name: 'c23',
              type: 'caf',
              target: './assets/audio/caf/c23.caf',
            },
            {
              name: 'c22',
              type: 'caf',
              target: './assets/audio/caf/c22.caf',
            },
            {
              name: 'c21',
              type: 'caf',
              target: './assets/audio/caf/c21.caf',
            },
            {
              name: 'c20',
              type: 'caf',
              target: './assets/audio/caf/c20.caf',
            },
            {
              name: 'c2',
              type: 'caf',
              target: './assets/audio/caf/c2.caf',
            },
            {
              name: 'c19',
              type: 'caf',
              target: './assets/audio/caf/c19.caf',
            },
            {
              name: 'c18',
              type: 'caf',
              target: './assets/audio/caf/c18.caf',
            },
            {
              name: 'c17',
              type: 'caf',
              target: './assets/audio/caf/c17.caf',
            },
            {
              name: 'c16',
              type: 'caf',
              target: './assets/audio/caf/c16.caf',
            },
            {
              name: 'c15',
              type: 'caf',
              target: './assets/audio/caf/c15.caf',
            },
            {
              name: 'c14',
              type: 'caf',
              target: './assets/audio/caf/c14.caf',
            },
            {
              name: 'c13',
              type: 'caf',
              target: './assets/audio/caf/c13.caf',
            },
            {
              name: 'c12',
              type: 'caf',
              target: './assets/audio/caf/c12.caf',
            },
            {
              name: 'c11',
              type: 'caf',
              target: './assets/audio/caf/c11.caf',
            },
            {
              name: 'c10',
              type: 'caf',
              target: './assets/audio/caf/c10.caf',
            },
            {
              name: 'c1',
              type: 'caf',
              target: './assets/audio/caf/c1.caf',
            },
            {
              name: 'beep',
              type: 'caf',
              target: './assets/audio/caf/beep.caf',
            },
          ],
        },
        android: {
          icon: './assets/adaptive-icon.png',
          color: '#2E3C4B',
          sounds: [
            './assets/audio/notification.mp3',
            './assets/audio/callclosed.mp3',
            './assets/audio/callupdated.mp3',
            './assets/audio/emergencycall.mp3',
            './assets/audio/highcall.mp3',
            './assets/audio/lowcall.mp3',
            './assets/audio/mediumcall.mp3',
            './assets/audio/newcall.mp3',
            './assets/audio/newchat.mp3',
            './assets/audio/newmessage.mp3',
            './assets/audio/newshift.mp3',
            './assets/audio/newtraining.mp3',
            './assets/audio/personnelstaffingupdated.mp3',
            './assets/audio/personnelstatusupdated.mp3',
            './assets/audio/troublealert.mp3',
            './assets/audio/unitnotice.mp3',
            './assets/audio/unitstatusupdated.mp3',
            './assets/audio/upcomingshift.mp3',
            './assets/audio/upcomingtraining.mp3',
            './assets/audio/ui/space_notification1.mp3',
            './assets/audio/ui/space_notification2.mp3',
            './assets/audio/ui/space_notification1.ogg',
            './assets/audio/ui/space_notification2.ogg',
            './assets/audio/custom/c1.mp3',
            './assets/audio/custom/c2.mp3',
            './assets/audio/custom/c3.mp3',
            './assets/audio/custom/c4.mp3',
            './assets/audio/custom/c5.mp3',
            './assets/audio/custom/c6.mp3',
            './assets/audio/custom/c7.mp3',
            './assets/audio/custom/c8.mp3',
            './assets/audio/custom/c9.mp3',
            './assets/audio/custom/c10.mp3',
            './assets/audio/custom/c11.mp3',
            './assets/audio/custom/c12.mp3',
            './assets/audio/custom/c13.mp3',
            './assets/audio/custom/c14.mp3',
            './assets/audio/custom/c15.mp3',
            './assets/audio/custom/c16.mp3',
            './assets/audio/custom/c17.mp3',
            './assets/audio/custom/c18.mp3',
            './assets/audio/custom/c19.mp3',
            './assets/audio/custom/c20.mp3',
            './assets/audio/custom/c21.mp3',
            './assets/audio/custom/c22.mp3',
            './assets/audio/custom/c23.mp3',
            './assets/audio/custom/c24.mp3',
            './assets/audio/custom/c25.mp3',
          ],
        },
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
        },
      },
    ],
    [
      'expo-asset',
      {
        assets: ['assets/mapping'],
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
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    './customGradle.plugin.js',
  ],
  extra: {
    ...ClientEnv,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
    },
  },
});
