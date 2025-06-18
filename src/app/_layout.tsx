// Import  global CSS file
import '../../global.css';
import '../lib/i18n';

import { Env } from '@env';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { registerGlobals } from '@livekit/react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { Stack, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider } from 'posthog-react-native';
import React, { useEffect } from 'react';
import { LogBox, useColorScheme } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APIProvider } from '@/api';
import { LiveKitBottomSheet } from '@/components/livekit';
import { FocusAwareStatusBar } from '@/components/ui';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { loadKeepAliveState } from '@/lib/hooks/use-keep-alive';
import { logger } from '@/lib/logging';
import { getDeviceUuid } from '@/lib/storage/app';
import { setDeviceUuid } from '@/lib/storage/app';
import { loadBackgroundGeolocationState } from '@/lib/storage/background-geolocation';
import { uuidv4 } from '@/lib/utils';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

// Construct a new integration instance. This is needed to communicate between the integration and React
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: Env.SENTRY_DSN,
  debug: true, // If `true`, Sentry will try to print out useful debugging information if something goes wrong with sending the event. Set it to `false` in production
  tracesSampleRate: 1.0, // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing. Adjusting this value in production.
  integrations: [
    // Pass integration
    navigationIntegration,
  ],
  enableNativeFramesTracking: !isRunningInExpoGo(), // Tracks slow and frozen frames in the application
});

registerGlobals();

//useAuth().hydrate();
//loadSelectedTheme();
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
]);

function RootLayout() {
  // Capture the NavigationContainer ref and register it with the integration.
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref?.current) {
      navigationIntegration.registerNavigationContainer(ref);
    }

    // Clear the badge count on app startup
    Notifications.setBadgeCountAsync(0)
      .then(() => {
        logger.info({
          message: 'Badge count cleared on startup',
        });
      })
      .catch((error) => {
        logger.error({
          message: 'Failed to clear badge count on startup',
          context: { error },
        });
      });

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
  }, [ref]);

  return (
    <Providers>
      <FocusAwareStatusBar hidden={true} />
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login/index" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();

  const renderContent = () => (
    <APIProvider>
      <GluestackUIProvider mode={(colorScheme ?? 'light') as 'light' | 'dark'}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <BottomSheetModalProvider>
            {children}
            <LiveKitBottomSheet />
            <FlashMessage position="top" />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </GluestackUIProvider>
    </APIProvider>
  );

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView>
        <KeyboardProvider>
          {Env.POSTHOG_API_KEY ? (
            <PostHogProvider apiKey={Env.POSTHOG_API_KEY} options={{ host: Env.POSTHOG_HOST }}>
              {renderContent()}
            </PostHogProvider>
          ) : (
            renderContent()
          )}
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
