/* eslint-env node */

const { getSentryExpoConfig } = require('@sentry/react-native/metro');
//const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname, {
  isCSSEnabled: true,
});

// 1. Watch all files within the monorepo
// 2. Let Metro know where to resolve packages and in what order
//config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Configure path aliases
//config.resolver.extraNodeModules = {
//  '@': path.resolve(__dirname, 'src'),
//  '@env': path.resolve(__dirname, 'src/lib/env.js'),
//  '@assets': path.resolve(__dirname, 'assets'),
//};

// Web-specific module resolution - redirect native modules to web shims
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Native modules that need web shims
    const nativeModules = [
      '@notifee/react-native',
      '@react-native-firebase/messaging',
      '@react-native-firebase/app',
      'react-native-callkeep',
      'react-native-ble-manager',
      '@livekit/react-native',
      '@livekit/react-native-webrtc',
      '@livekit/react-native-expo-plugin',
    ];

    if (nativeModules.includes(moduleName)) {
      return {
        filePath: path.resolve(__dirname, 'src/lib/native-module-shims.web.ts'),
        type: 'sourceFile',
      };
    }

    // Countly SDK needs its own shim with proper default export.
    // The CountlyConfig subpath must resolve to a dedicated shim whose
    // default export is the CountlyConfig class (not the Countly object).
    if (moduleName === 'countly-sdk-react-native-bridge/CountlyConfig') {
      return {
        filePath: path.resolve(__dirname, 'src/lib/countly-config-shim.web.ts'),
        type: 'sourceFile',
      };
    }
    if (moduleName === 'countly-sdk-react-native-bridge' || moduleName.startsWith('countly-sdk-react-native-bridge/')) {
      return {
        filePath: path.resolve(__dirname, 'src/lib/countly-shim.web.ts'),
        type: 'sourceFile',
      };
    }

    // Force zustand and related packages to use CJS build instead of ESM
    // The ESM build uses import.meta.env which Metro doesn't support
    const zustandModules = {
      zustand: path.resolve(__dirname, 'node_modules/zustand/index.js'),
      'zustand/shallow': path.resolve(__dirname, 'node_modules/zustand/shallow.js'),
      'zustand/middleware': path.resolve(__dirname, 'node_modules/zustand/middleware.js'),
      'zustand/traditional': path.resolve(__dirname, 'node_modules/zustand/traditional.js'),
      'zustand/vanilla': path.resolve(__dirname, 'node_modules/zustand/vanilla.js'),
      'zustand/context': path.resolve(__dirname, 'node_modules/zustand/context.js'),
    };

    if (zustandModules[moduleName]) {
      return {
        filePath: zustandModules[moduleName],
        type: 'sourceFile',
      };
    }

    // Block build-time/dev packages that use import.meta from being bundled
    // These are dev tools that should never be included in a client bundle
    const buildTimePackages = ['tinyglobby', 'fdir', 'node-gyp', 'electron-builder', 'electron-rebuild', '@electron/rebuild', 'app-builder-lib', 'dmg-builder'];

    if (buildTimePackages.some((pkg) => moduleName === pkg || moduleName.startsWith(`${pkg}/`))) {
      // Return an empty module shim
      return {
        filePath: path.resolve(__dirname, 'src/lib/empty-module.web.js'),
        type: 'sourceFile',
      };
    }
  }

  // Use the original resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
