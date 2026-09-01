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

// Declares the Live Activity widget extension to EAS so it provisions a matching
// profile and signs the embedded .appex with the SAME certificate as the parent
// app. Without this the widget builds unsigned and the archive fails with
// "Embedded binary is not signed with the same certificate as the parent app".
// Mirrors the Responder app's working Live Activity signing setup.
const liveActivityExtension = {
  targetName: 'CheckInTimerWidget',
  bundleIdentifier: `${Env.BUNDLE_ID}.CheckInTimerWidget`,
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
    infoPlist: {
      UIBackgroundModes: ['remote-notification', 'audio', 'bluetooth-central', 'voip'],
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: false,
      NSBluetoothAlwaysUsageDescription:
        'Resgrid Unit uses Bluetooth to connect to wireless headsets and speaker-microphone accessories for Push-to-Talk audio. For example, when you pair a Bluetooth speaker-mic, pressing its talk button transmits your voice to your department audio channel.',
      // Allow the app to open its own custom-scheme deep links (needed for SSO callbacks)
      LSApplicationQueriesSchemes: ['resgridunit'],
    },
    entitlements: {
      // Required for APNs registration. Previously added by the expo-notifications
      // plugin; set explicitly so removing/swapping plugins can never silently drop
      // it (which previously broke ALL iOS push — see docs/ios-foreground-notifications-fix.md).
      'aps-environment': 'production',
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
    // 'pan' makes Android scroll the window under the IME on its own, which fights
    // react-native-keyboard-controller. Its hooks flip the activity to adjustResize on
    // mount and call setDefaultMode() on unmount, restoring whatever this value is — so
    // with 'pan' any closing sheet or modal drops the app back into pan mode and inputs
    // end up under the keyboard. Edge-to-edge means the OS no longer resizes for us
    // either, so 'resize' leaves keyboard avoidance entirely to the library.
    softwareKeyboardLayoutMode: 'resize',
    package: Env.PACKAGE,
    googleServicesFile: 'google-services.json',
    // Register the ResgridUnit:// deep-link scheme so OIDC / SAML callbacks are routed back here
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: false,
        data: [{ scheme: 'resgridunit' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    permissions: [
      'android.permission.WAKE_LOCK',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAPTURE_AUDIO_OUTPUT',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      // Department audio (scanner) streams keep playing while backgrounded through
      // expo-audio's AudioControlsService. The expo-audio config plugin adds this permission
      // too, but it is declared here so the FGS types the app actually uses are all visible
      // in one place next to the Play declarations.
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.READ_PHONE_STATE',
      'android.permission.READ_PHONE_NUMBERS',
      'android.permission.MANAGE_OWN_CALLS',
    ],
    // FOREGROUND_SERVICE_CONNECTED_DEVICE is blocked, not merely absent: Bluetooth PTT handsets
    // route through the microphone FGS session, so the type is unused, and Play rejects any
    // declared foreground-service type whose use case cannot be demonstrated in the app.
    blockedPermissions: ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE'],
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
    'expo-web-browser',
    [
      'expo-secure-store',
      {
        // Required even though biometric-gated storage is not used: expo-secure-store
        // instantiates LAContext() unconditionally (SecureStoreModule.swift), so App Store
        // static analysis flags a missing NSFaceIDUsageDescription with ITMS-90683 — the same
        // way it flagged the omitted NSMotionUsageDescription.
        faceIDPermission:
          'Resgrid Unit uses Face ID to unlock the securely stored credentials that keep you signed in to your department. For example, after your device locks, Face ID confirms it is you before the app restores your session and shows active calls.',
      },
    ],
    'expo-image',
    'expo-sharing',
    'expo-status-bar',
    [
      '@rnmapbox/maps',
      {
        // Keep in step with the `mapbox` field of the installed @rnmapbox/maps — the JS
        // bindings are generated against a specific native SDK, and pinning an older one
        // makes style props the bindings emit (symbolZOffset and friends) trap natively.
        RNMapboxMapsVersion: '11.23.1',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Resgrid Unit uses your location while you use the app to show your unit position on the department map and to attach your coordinates when you set a status or respond to a call. For example, when you respond to a call, your location is shared with dispatch so they can see which unit is closest to the scene.',
        locationAlwaysAndWhenInUsePermission:
          'Resgrid Unit uses your location, including in the background, to keep your department dispatch map updated with your unit position (automatic vehicle location). For example, while you are en route to an emergency call, your unit location is periodically sent to dispatchers so they can track your arrival and coordinate resources, even when the app is not on screen.',
        locationAlwaysPermission:
          'Resgrid Unit uses your location in the background to keep your department dispatch map updated with your unit position (automatic vehicle location). For example, while you are en route to an emergency call, your unit location is periodically sent to dispatchers so they can track your arrival and coordinate resources, even when the app is not on screen.',
        // Required even though getMotionActivityAsync() is never called: expo-location links
        // CoreMotion (MotionActivityPermissionRequester), and App Store static analysis rejects
        // the binary with ITMS-90683 whenever the framework is referenced and the string is
        // absent. Setting this to false previously caused that rejection.
        motionUsagePermission:
          'Resgrid Unit uses motion data to improve the accuracy of your unit location on the department map. For example, while you are driving to a call, motion data helps distinguish travel from a stop so dispatchers see an accurate position and heading for your unit.',
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
          targetSdkVersion: 36,
        },
        ios: {
          deploymentTarget: '18.1',
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
      'expo-image-picker',
      {
        photosPermission:
          'Resgrid Unit uses your photo library so you can attach existing photos to calls and chat messages. For example, you can select a saved photo of an incident scene and share it with dispatch and other responders on the call.',
        cameraPermission:
          'Resgrid Unit uses the camera to take photos that you attach to calls and for video during department video sessions. For example, you can photograph an incident scene and attach the image to the active call for other responders to see.',
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
        microphonePermission:
          'Resgrid Unit uses the microphone to capture your voice for Push-to-Talk and voice calls with your department. For example, when you press and hold the talk button, your voice is transmitted live to other responders on the channel.',
      },
    ],
    'expo-video',
    'react-native-ble-manager',
    '@livekit/react-native-expo-plugin',
    [
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission:
          'Resgrid Unit uses the camera to take photos that you attach to calls and for video during department video sessions. For example, you can photograph an incident scene and attach the image to the active call for other responders to see.',
      },
    ],
    '@config-plugins/react-native-callkeep',
    'expo-notifications',
    './customGradle.plugin.js',
    './customManifest.plugin.js',
    './plugins/withNotificationSounds.js',
    './plugins/withMediaButtonModule.js',
    [
      './plugins/withCheckInLiveActivity.js',
      {
        teamId: 'QKQVAJMTCN',
      },
    ],
    './plugins/withInCallAudioModule.js',
    ['./plugins/with-app-icon-badge.js', appIconBadgeConfig],
  ],
  extra: {
    ...ClientEnv,
    eas: {
      projectId: Env.EAS_PROJECT_ID,
      build: {
        experimental: {
          ios: {
            appExtensions: [liveActivityExtension],
          },
        },
      },
    },
  },
});
