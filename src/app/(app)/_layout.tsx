/* eslint-disable react/no-unstable-nested-components */

import { NovuProvider } from '@novu/react-native';
import { Redirect, SplashScreen, Tabs } from 'expo-router';
import { Contact, ListTree, Map, Megaphone, Menu, Notebook, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationButton } from '@/components/notifications/NotificationButton';
import { NotificationInbox } from '@/components/notifications/NotificationInbox';
import Sidebar from '@/components/sidebar/sidebar';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { Button, ButtonText } from '@/components/ui/button';
import { Drawer, DrawerBackdrop, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useSignalRLifecycle } from '@/hooks/use-signalr-lifecycle';
import { useAuthStore } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { useIsFirstTime } from '@/lib/storage';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { audioService } from '@/services/audio.service';
import { bluetoothAudioService } from '@/services/bluetooth-audio.service';
import { usePushNotifications } from '@/services/push-notification';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

export default function TabLayout() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const [isFirstTime, _setIsFirstTime] = useIsFirstTime();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isInitComplete, setIsInitComplete] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  const { isActive, appState } = useAppLifecycle();
  const { trackEvent } = useAnalytics();

  // Refs to track initialization state
  const hasInitialized = useRef(false);
  const isInitializing = useRef(false);
  const hasHiddenSplash = useRef(false);
  const lastSignedInStatus = useRef<string | null>(null);
  const parentRef = useRef(null);

  // Render counting for diagnostics (web only)
  const renderCount = useRef(0);
  renderCount.current += 1;
  if (__DEV__ && Platform.OS === 'web' && renderCount.current % 50 === 0) {
    console.warn(`[TabLayout] render #${renderCount.current}`, {
      status,
      isInitComplete,
      isOpen,
      isLandscape,
    });
  }

  const hideSplash = useCallback(async () => {
    if (hasHiddenSplash.current) return;

    try {
      await SplashScreen.hideAsync();
      hasHiddenSplash.current = true;
      logger.info({
        message: 'Splash screen hidden',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to hide splash screen',
        context: { error },
      });
    }
  }, []);

  // Initialize push notifications
  usePushNotifications();

  // Track when home view is rendered (debounced - don't fire on every resize)
  const lastTrackRef = useRef(0);
  useEffect(() => {
    if (status === 'signedIn') {
      const now = Date.now();
      if (now - lastTrackRef.current > 5000) {
        lastTrackRef.current = now;
        trackEvent('home_view_rendered', {
          isLandscape: isLandscape,
          screenWidth: width,
          screenHeight: height,
        });
      }
    }
  }, [status, trackEvent, isLandscape, width, height]);

  const initializeApp = useCallback(async () => {
    if (isInitializing.current) {
      logger.info({
        message: 'App initialization already in progress, skipping',
      });
      return;
    }

    if (status !== 'signedIn') {
      logger.info({
        message: 'User not signed in, skipping initialization',
        context: { status },
      });
      return;
    }

    isInitializing.current = true;
    logger.info({
      message: 'Starting app initialization',
      context: {
        hasInitialized: hasInitialized.current,
      },
    });

    try {
      // Initialize core app data (init() calls fetchConfig() internally)
      await useCoreStore.getState().init();
      await useRolesStore.getState().init();
      await useCallsStore.getState().init();
      await securityStore.getState().getRights();

      await useSignalRStore.getState().connectUpdateHub();
      await useSignalRStore.getState().connectGeolocationHub();

      hasInitialized.current = true;

      // Initialize Bluetooth and Audio services (native-only)
      if (Platform.OS !== 'web') {
        await bluetoothAudioService.initialize();
        await audioService.initialize();
      }

      logger.info({
        message: 'App initialization completed successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize app',
        context: { error },
      });
      // Reset initialization state on error so it can be retried
      hasInitialized.current = false;
    } finally {
      isInitializing.current = false;
      setIsInitComplete(true);
    }
  }, [status]);

  const refreshDataFromBackground = useCallback(async () => {
    if (status !== 'signedIn' || !hasInitialized.current) return;

    logger.info({
      message: 'App resumed from background, refreshing data',
    });

    try {
      // Refresh data
      await Promise.all([useCoreStore.getState().fetchConfig(), useCallsStore.getState().fetchCalls(), useRolesStore.getState().fetchRoles()]);
    } catch (error) {
      logger.error({
        message: 'Failed to refresh data on app resume',
        context: { error },
      });
    }
  }, [status]);

  // Handle SignalR lifecycle management
  useSignalRLifecycle({
    isSignedIn: status === 'signedIn',
    hasInitialized: hasInitialized.current,
  });

  // Handle splash screen hiding
  useEffect(() => {
    if (status !== 'idle' && !hasHiddenSplash.current) {
      const timer = setTimeout(() => {
        hideSplash();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [status, hideSplash]);

  // Handle app initialization - simplified logic
  useEffect(() => {
    const shouldInitialize = status === 'signedIn' && !hasInitialized.current && !isInitializing.current && lastSignedInStatus.current !== 'signedIn';

    if (shouldInitialize) {
      logger.info({
        message: 'Triggering app initialization',
        context: {
          statusChanged: lastSignedInStatus.current !== status,
        },
      });
      initializeApp();
    }

    // Update last known status
    lastSignedInStatus.current = status;
  }, [status, initializeApp]);

  // Handle app resuming from background - separate from initialization
  useEffect(() => {
    // On web, isActive/appState are always active — skip the initial fire
    // and only refresh when they genuinely change (i.e., on native background→foreground)
    if (Platform.OS === 'web') return;

    // Only trigger on state change, not on initial render
    if (isActive && appState === 'active' && hasInitialized.current) {
      const timer = setTimeout(() => {
        refreshDataFromBackground();
      }, 500); // Small delay to prevent multiple rapid calls

      return () => clearTimeout(timer);
    }
  }, [isActive, appState, refreshDataFromBackground]);

  // Force drawer open in landscape (guard with functional update to avoid unnecessary re-render)
  useEffect(() => {
    if (isLandscape) {
      setIsOpen((prev) => (prev ? prev : true));
    }
  }, [isLandscape]);

  // Get user ID and config for notifications
  const config = useCoreStore((state) => state.config);
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const rights = securityStore((state) => state.rights);

  // Compute Novu readiness once for consistent gating across the render
  const novuReady = !!(activeUnitId && config?.NovuApplicationId && config?.NovuBackendApiUrl && config?.NovuSocketUrl && rights?.DepartmentCode);
  // Cache the last known-good Novu config so NovuProvider stays mounted stably
  // even if a transient state update briefly nullifies one of the values.
  const lastNovuConfig = useRef<{
    subscriberId: string;
    applicationIdentifier: string;
    backendUrl: string;
    socketUrl: string;
  } | null>(null);
  if (novuReady) {
    lastNovuConfig.current = {
      subscriberId: `${rights?.DepartmentCode}_Unit_${activeUnitId}`,
      applicationIdentifier: config!.NovuApplicationId,
      backendUrl: config!.NovuBackendApiUrl,
      socketUrl: config!.NovuSocketUrl,
    };
  }

  // Memoize screen options to prevent new objects every render
  const screenOptions = React.useMemo(
    () => ({
      headerShown: true,
      tabBarShowLabel: true,
      tabBarIconStyle: {
        width: 24,
        height: 24,
      },
      tabBarLabelStyle: {
        fontSize: isLandscape ? 12 : 10,
        fontWeight: '500' as const,
      },
      tabBarStyle: {
        paddingBottom: Math.max(insets.bottom, 5),
        paddingTop: 5,
        height: isLandscape ? 65 : Math.max(60 + insets.bottom, 60),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 100,
        backgroundColor: 'transparent',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
      },
    }),
    [isLandscape, insets.bottom]
  );

  // Memoize header callbacks to prevent new function refs every render
  const handleOpenDrawer = useCallback(() => setIsOpen(true), []);
  const handleCloseDrawer = useCallback(() => setIsOpen(false), []);
  const handleOpenNotifications = useCallback(() => setIsNotificationsOpen(true), []);
  const handleCloseNotifications = useCallback(() => setIsNotificationsOpen(false), []);

  // Memoize per-screen tab bar icon renderers to prevent new functions every render
  const mapIcon = useCallback(({ color }: { color: string }) => <Icon as={Map} stroke={color} className="text-primary-500 dark:text-primary-400" />, []);
  const callsIcon = useCallback(({ color }: { color: string }) => <Icon as={Megaphone} stroke={color} className="text-primary-500 dark:text-primary-400" />, []);
  const contactsIcon = useCallback(({ color }: { color: string }) => <Icon as={Contact} stroke={color} className="text-primary-500 dark:text-primary-400" />, []);
  const notesIcon = useCallback(({ color }: { color: string }) => <Icon as={Notebook} stroke={color} />, []);
  const protocolsIcon = useCallback(({ color }: { color: string }) => <Icon as={ListTree} stroke={color} />, []);
  const settingsIcon = useCallback(({ color }: { color: string }) => <Icon as={Settings} stroke={color} />, []);

  // Memoize header left/right renders
  const headerLeftMap = useCallback(() => <CreateDrawerMenuButton setIsOpen={setIsOpen} isLandscape={isLandscape} />, [isLandscape]);
  const headerRightNotification = useCallback(
    () => <CreateNotificationButton config={config} setIsNotificationsOpen={handleOpenNotifications} activeUnitId={activeUnitId} departmentCode={rights?.DepartmentCode} />,
    [config, handleOpenNotifications, activeUnitId, rights?.DepartmentCode]
  );

  // Memoize per-screen options to prevent new objects every render
  const indexOptions = useMemo(
    () => ({
      title: t('tabs.map'),
      tabBarIcon: mapIcon,
      headerLeft: headerLeftMap,
      tabBarButtonTestID: 'map-tab' as const,
      headerRight: headerRightNotification,
    }),
    [t, mapIcon, headerLeftMap, headerRightNotification]
  );

  const callsOptions = useMemo(
    () => ({
      title: t('tabs.calls'),
      headerShown: true as const,
      tabBarIcon: callsIcon,
      tabBarButtonTestID: 'calls-tab' as const,
      headerRight: headerRightNotification,
    }),
    [t, callsIcon, headerRightNotification]
  );

  const contactsOptions = useMemo(
    () => ({
      title: t('tabs.contacts'),
      headerShown: true as const,
      tabBarIcon: contactsIcon,
      tabBarButtonTestID: 'contacts-tab' as const,
      headerRight: headerRightNotification,
    }),
    [t, contactsIcon, headerRightNotification]
  );

  const notesOptions = useMemo(
    () => ({
      title: t('tabs.notes'),
      headerShown: true as const,
      tabBarIcon: notesIcon,
      tabBarButtonTestID: 'notes-tab' as const,
      headerRight: headerRightNotification,
    }),
    [t, notesIcon, headerRightNotification]
  );

  const protocolsOptions = useMemo(
    () => ({
      title: t('tabs.protocols'),
      headerShown: true as const,
      tabBarIcon: protocolsIcon,
      tabBarButtonTestID: 'protocols-tab' as const,
      headerRight: headerRightNotification,
    }),
    [t, protocolsIcon, headerRightNotification]
  );

  const settingsOptions = useMemo(
    () => ({
      title: t('tabs.settings'),
      headerShown: true as const,
      tabBarIcon: settingsIcon,
      tabBarButtonTestID: 'settings-tab' as const,
    }),
    [t, settingsIcon]
  );

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  // Guard against rendering full UI before auth state is determined
  if (status !== 'signedIn') {
    return <Redirect href="/login" />;
  }

  const content = (
    <View style={styles.container} pointerEvents="box-none">
      {/* Loading overlay during initialization — shown on top of Tabs so the navigator stays mounted */}
      {!isInitComplete ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}
      <View className="flex-1 flex-row" ref={parentRef}>
        {/* Drawer and sidebar only render after init to avoid heavy re-renders during store settling */}
        {isInitComplete ? (
          isLandscape ? (
            <View className="w-1/4 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <Sidebar />
            </View>
          ) : (
            <Drawer isOpen={isOpen} onClose={handleCloseDrawer} {...({} as any)}>
              <DrawerBackdrop onPress={handleCloseDrawer} />
              <DrawerContent className="w-4/5 bg-white p-1 dark:bg-gray-900">
                <DrawerBody>
                  <Sidebar />
                </DrawerBody>
              </DrawerContent>
            </Drawer>
          )
        ) : null}

        {/* Main content area */}
        <View className={`flex-1 ${isLandscape ? 'w-3/4' : 'w-full'}`}>
          <Tabs screenOptions={screenOptions}>
            <Tabs.Screen name="index" options={indexOptions} />

            <Tabs.Screen name="calls" options={callsOptions} />

            <Tabs.Screen name="contacts" options={contactsOptions} />

            <Tabs.Screen name="notes" options={notesOptions} />

            <Tabs.Screen name="protocols" options={protocolsOptions} />

            <Tabs.Screen name="settings" options={settingsOptions} />
          </Tabs>

          {/* NotificationInbox positioned within the tab content area — only after init and Novu is ready */}
          {isInitComplete && novuReady && <NotificationInbox isOpen={isNotificationsOpen} onClose={handleCloseNotifications} />}
        </View>
      </View>
    </View>
  );

  // Keep NovuProvider mounted once it has been initialized to avoid full tree
  // unmount/remount. We use the cached config so even if novuReady briefly goes
  // false during a config re-fetch, the provider stays up with last-good props.
  if (lastNovuConfig.current) {
    return (
      <NovuProvider
        subscriberId={lastNovuConfig.current.subscriberId}
        applicationIdentifier={lastNovuConfig.current.applicationIdentifier}
        backendUrl={lastNovuConfig.current.backendUrl}
        socketUrl={lastNovuConfig.current.socketUrl}
      >
        {content}
      </NovuProvider>
    );
  }

  return content;
}

interface CreateDrawerMenuButtonProps {
  setIsOpen: (isOpen: boolean) => void;
  isLandscape: boolean;
}

const CreateDrawerMenuButton = ({ setIsOpen, isLandscape }: CreateDrawerMenuButtonProps) => {
  if (isLandscape) {
    return null;
  }

  return (
    <Pressable
      className="p-3"
      onPress={() => {
        setIsOpen(true);
      }}
    >
      <Menu size={24} color="currentColor" className="text-gray-700 dark:text-gray-300" />
    </Pressable>
  );
};

const CreateNotificationButton = ({
  config,
  setIsNotificationsOpen,
  activeUnitId,
  departmentCode,
}: {
  config: GetConfigResultData | null;
  setIsNotificationsOpen: () => void;
  activeUnitId: string | null;
  departmentCode: string | undefined;
}) => {
  if (!activeUnitId || !config || !config.NovuApplicationId || !config.NovuBackendApiUrl || !config.NovuSocketUrl || !departmentCode) {
    return null;
  }

  // No NovuProvider here — the outer NovuProvider in TabLayout already wraps everything,
  // so NotificationButton can access Novu context directly. This avoids creating 5 duplicate
  // socket.io connections (one per tab header).
  return <NotificationButton onPress={setIsNotificationsOpen} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#ffffff' : undefined,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? '#ffffff' : 'rgba(255,255,255,0.95)',
    zIndex: 1000,
  },
});
