// Import global CSS (platform-specific entry: global.css on native, global.web.css on web)
import '../lib/theme-styles';
import '../lib/i18n';
// Side-effect import: registers the full app-data wipe as the session-cleanup
// handler for every logout path (manual, forced 401, refresh rejection).
import '@/services/app-reset.service';

import { Env } from '@env';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { registerGlobals } from '@livekit/react-native';
import notifee from '@notifee/react-native';
import type { EventHint } from '@sentry/core';
import type { ErrorEvent, StackFrame } from '@sentry/react-native';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APIProvider } from '@/api';
import { CountlyProvider } from '@/components/common/countly-provider';
import { LiveKitBottomSheet } from '@/components/livekit';
import { PushNotificationModal } from '@/components/push-notification/push-notification-modal';
import { StatusBottomSheet } from '@/components/status/status-bottom-sheet';
import { ToastContainer } from '@/components/toast/toast-container';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { loadKeepAliveState } from '@/lib/hooks/use-keep-alive';
import { loadSelectedTheme } from '@/lib/hooks/use-selected-theme';
import { logger } from '@/lib/logging';
import { registerNavigationReadyCheck } from '@/lib/navigation';
import { getDeviceUuid, setDeviceUuid } from '@/lib/storage/app';
import { loadBackgroundGeolocationState } from '@/lib/storage/background-geolocation';
import { uuidv4 } from '@/lib/utils';
import { appInitializationService } from '@/services/app-initialization.service';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

// Construct a new integration instance. This is needed to communicate between the integration and React
const navigationIntegration = Sentry.reactNavigationIntegration({
  // Disable enableTimeToInitialDisplay to prevent fallback timestamp errors
  enableTimeToInitialDisplay: false,
});

// Sentry's own logger is off by default: watchdog-termination tracking rewrites the
// native scope on every RNSentry turbo-module call, so `debug` floods the Metro
// console with hundreds of "Writing tags to disk" lines a second. Flip to `__DEV__`
// temporarily when diagnosing Sentry itself.
const SENTRY_DEBUG = false;

Sentry.init({
  dsn: Env.SENTRY_DSN,
  debug: SENTRY_DEBUG,
  tracesSampleRate: __DEV__ ? 0.1 : 0.2, // 10% in dev (low to avoid setTimeout wrapping overhead), 20% in production
  profilesSampleRate: __DEV__ ? 0.1 : 0.2, // 10% in dev, 20% in production
  sendDefaultPii: false,
  integrations: [
    // Pass integration
    navigationIntegration,
  ],
  enableNativeFramesTracking: Platform.OS !== 'web', //!isRunningInExpoGo(), // Tracks slow and frozen frames in the application
  beforeSend(event: ErrorEvent, _hint: EventHint) {
    // Filter known Mapbox GL JS bug: GeolocateControl._onSuccess calls
    // fitBounds/_cameraForBoundsOnGlobe which throws when the globe
    // projection matrix is null (TypeError: Cannot read properties of null (reading '3'))
    const values = event.exception?.values;
    if (values?.length) {
      const top = values[values.length - 1];
      if (top.type === 'TypeError' && top.value?.includes("Cannot read properties of null (reading '3')")) {
        const frames = top.stacktrace?.frames;
        if (frames?.some((f: StackFrame) => f.function?.includes('_cameraForBounds') || f.function?.includes('GeolocateControl') || f.function?.includes('fromInvProjectionMatrix'))) {
          return null;
        }
      }
    }
    return event;
  },
  // Add additional options to prevent timing issues
  beforeSendTransaction(event: any) {
    // Filter out problematic navigation transactions that might cause timestamp errors
    if (event.contexts?.trace?.op === 'navigation' && !event.contexts?.trace?.data?.route) {
      return null;
    }
    return event;
  },
});

// Only register LiveKit globals on native platforms
// Web/Electron uses livekit-client which handles WebRTC natively
if (Platform.OS !== 'web') {
  registerGlobals();
}

// Load the selected theme from storage and apply it
loadSelectedTheme();

// Prevent the splash screen from auto-hiding before asset loading is complete.
//SplashScreen.preventAutoHideAsync();
// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

const deviceUuid = getDeviceUuid();
if (!deviceUuid) {
  setDeviceUuid(uuidv4());
}

LogBox.ignoreLogs([
  //Mapbox errors
  'Mapbox [error] ViewTagResolver | view:',
  // Ignore Sentry fallback timestamp warnings in development
  'Sentry Logger [error]: Failed to receive any fallback timestamp',
]);

function RootLayout() {
  // Capture the NavigationContainer ref and register it with the integration.
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref?.current) {
      navigationIntegration.registerNavigationContainer(ref);
    }

    // Cold-start deep links (a push-notification tap that launched the app) fire before
    // this tree mounts. Publish the container's own readiness so routerPushWithRetry can
    // wait for a real signal instead of a thrown error expo-router never raises.
    registerNavigationReadyCheck(() => ref?.isReady?.() ?? false);

    // Clear the badge count on app startup (native only — notifee has no web implementation)
    if (Platform.OS !== 'web') {
      notifee
        .setBadgeCount(0)
        .then(() => {
          logger.info({
            message: 'Badge count cleared on startup',
          });
        })
        .catch((error: Error) => {
          logger.error({
            message: 'Failed to clear badge count on startup',
            context: { error },
          });
        });
    }

    // Load keep alive state on app startup
    loadKeepAliveState()
      .then(() => {
        logger.info({
          message: 'Keep alive state loaded on startup',
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to load keep alive state on startup',
          context: { error },
        });
      });

    // Load background geolocation state on app startup
    loadBackgroundGeolocationState()
      .then(() => {
        logger.info({
          message: 'Background geolocation state loaded on startup',
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to load background geolocation state on startup',
          context: { error },
        });
      });

    // Initialize global app services (including CallKeep for iOS)
    appInitializationService
      .initialize()
      .then(() => {
        logger.info({
          message: 'Global app services initialized successfully',
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to initialize global app services',
          context: { error },
        });
      });
  }, [ref]);

  return (
    <Providers>
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login/index" options={{ headerShown: false }} />
        <Stack.Screen name="routes" options={{ headerShown: false }} />
        <Stack.Screen name="maps" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  // nativewind's hook (not react-native's) so manually selected themes are
  // reflected on web, where Appearance only tracks the system preference.
  const { colorScheme } = useColorScheme();

  const renderContent = () => (
    <APIProvider>
      <GluestackUIProvider mode={(colorScheme ?? 'light') as 'light' | 'dark'}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <BottomSheetModalProvider>
            {children}
            <LiveKitBottomSheet />
            {/* Driven entirely by useStatusBottomSheetStore, so it is mounted once here.
                Mounting it per-screen stacked duplicate Actionsheets (each with its own
                backdrop and destination fetch) whenever those screens were alive together. */}
            <StatusBottomSheet />
            <PushNotificationModal />
            <FlashMessage position="top" />
            <ToastContainer />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </GluestackUIProvider>
    </APIProvider>
  );

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView>
        <KeyboardProvider>
          {Env.COUNTLY_APP_KEY ? (
            <CountlyProvider appKey={Env.COUNTLY_APP_KEY} serverURL={Env.COUNTLY_SERVER_URL}>
              {renderContent()}
            </CountlyProvider>
          ) : (
            renderContent()
          )}
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
