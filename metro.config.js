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
  }

  // Use the original resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
