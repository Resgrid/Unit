/* eslint-disable react/no-unstable-nested-components */

import { NovuProvider } from '@novu/react-native';
import { Redirect, SplashScreen, Tabs } from 'expo-router';
import { Contact, ListTree, Map, Megaphone, Menu, Notebook, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { NotificationButton } from '@/components/notifications/NotificationButton';
import { NotificationInbox } from '@/components/notifications/NotificationInbox';
import Sidebar from '@/components/sidebar/sidebar';
import { View } from '@/components/ui';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Drawer, DrawerBackdrop, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/auth';
import { useIsFirstTime } from '@/lib/storage';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { bluetoothAudioService } from '@/services/bluetooth-audio.service';
import { usePushNotifications } from '@/services/push-notification';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';

export default function TabLayout() {
  const { t } = useTranslation();
  const { status } = useAuthStore();
  const [isFirstTime, _setIsFirstTime] = useIsFirstTime();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);
  const parentRef = useRef(null);

  // Initialize push notifications
  usePushNotifications();

  useEffect(() => {
    if (status !== 'idle') {
      setTimeout(() => {
        hideSplash();
      }, 1000);
    }

    if (status === 'signedIn') {
      useCoreStore.getState().init();
      useRolesStore.getState().init();
      useCallsStore.getState().init();
      securityStore.getState().getRights();
      useCoreStore.getState().fetchConfig();

      // Initialize Bluetooth service
      bluetoothAudioService.initialize().catch((error) => {
        console.warn('Failed to initialize Bluetooth service:', error);
      });
    }
  }, [hideSplash, status]);

  // Force drawer open in landscape
  useEffect(() => {
    if (isLandscape) {
      setIsOpen(true);
    }
  }, [isLandscape]);

  // Get user ID and config for notifications
  const config = useCoreStore((state) => state.config);
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const rights = securityStore((state) => state.rights);

  if (isFirstTime) {
    //setIsOnboarding();
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  const content = (
    <View style={styles.container}>
      <View className="flex-1 flex-row" ref={parentRef}>
        {/* Drawer - conditionally rendered as permanent in landscape */}
        {isLandscape ? (
          <View className="w-1/4 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <Sidebar />
          </View>
        ) : (
          <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)}>
            <DrawerBackdrop onPress={() => setIsOpen(false)} />
            <DrawerContent className="w-4/5 bg-white dark:bg-gray-900">
              <DrawerHeader className="border-b border-gray-200 dark:border-gray-800">
                <Text className="text-xl font-bold">Menu</Text>
              </DrawerHeader>
              <DrawerBody>
                <Sidebar />
              </DrawerBody>
              <DrawerFooter>
                <Button onPress={() => setIsOpen(false)} className="w-full bg-primary-600">
                  <ButtonText>Close</ButtonText>
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}

        {/* Main content area */}
        <View className={`flex-1 ${isLandscape ? 'w-3/4' : 'w-full'}`}>
          <Tabs
            screenOptions={{
              headerShown: true,
              tabBarShowLabel: true,
              tabBarIconStyle: {
                width: 24,
                height: 24,
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: t('tabs.map'),
                tabBarIcon: ({ color }) => <Icon as={Map} stroke={color} className="text-primary-500 dark:text-primary-400" />,
                headerLeft: () => <CreateDrawerMenuButton setIsOpen={setIsOpen} isLandscape={isLandscape} />,
                tabBarButtonTestID: 'map-tab',
                headerRight: () => <CreateNotificationButton config={config} setIsNotificationsOpen={setIsNotificationsOpen} activeUnitId={activeUnitId} departmentCode={rights?.DepartmentCode} />,
              }}
            />

            <Tabs.Screen
              name="calls"
              options={{
                title: t('tabs.calls'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={Megaphone} stroke={color} className="text-primary-500 dark:text-primary-400" />,
                tabBarButtonTestID: 'calls-tab',
                headerRight: () => <CreateNotificationButton config={config} setIsNotificationsOpen={setIsNotificationsOpen} activeUnitId={activeUnitId} departmentCode={rights?.DepartmentCode} />,
              }}
            />

            <Tabs.Screen
              name="contacts"
              options={{
                title: t('tabs.contacts'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={Contact} stroke={color} className="text-primary-500 dark:text-primary-400" />,
                tabBarButtonTestID: 'contacts-tab',
                headerRight: () => <CreateNotificationButton config={config} setIsNotificationsOpen={setIsNotificationsOpen} activeUnitId={activeUnitId} departmentCode={rights?.DepartmentCode} />,
              }}
            />

            <Tabs.Screen
              name="notes"
              options={{
                title: t('tabs.notes'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={Notebook} stroke={color} />,
                tabBarButtonTestID: 'notes-tab',
                headerRight: () => <CreateNotificationButton config={config} setIsNotificationsOpen={setIsNotificationsOpen} activeUnitId={activeUnitId} departmentCode={rights?.DepartmentCode} />,
              }}
            />

            <Tabs.Screen
              name="protocols"
              options={{
                title: t('tabs.protocols'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={ListTree} stroke={color} />,
                tabBarButtonTestID: 'protocols-tab',
                headerRight: () => <CreateNotificationButton config={config} setIsNotificationsOpen={setIsNotificationsOpen} activeUnitId={activeUnitId} departmentCode={rights?.DepartmentCode} />,
              }}
            />

            <Tabs.Screen
              name="settings"
              options={{
                title: t('tabs.settings'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={Settings} stroke={color} />,
                tabBarButtonTestID: 'settings-tab',
              }}
            />
          </Tabs>
        </View>
      </View>
    </View>
  );

  return (
    <>
      {activeUnitId && config && rights?.DepartmentCode ? (
        <NovuProvider subscriberId={`${rights?.DepartmentCode}_Unit_${activeUnitId}`} applicationIdentifier={config.NovuApplicationId} backendUrl={config.NovuBackendApiUrl} socketUrl={config.NovuSocketUrl}>
          {/* NotificationInbox at the root level */}
          <NotificationInbox isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
          {content}
        </NovuProvider>
      ) : (
        content
      )}
    </>
  );
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
    <Button
      size="lg"
      className="rounded-full p-3.5"
      onPress={() => {
        setIsOpen(true);
      }}
    >
      <ButtonIcon as={Menu} />
    </Button>
  );
};

const CreateNotificationButton = ({
  config,
  setIsNotificationsOpen,
  activeUnitId,
  departmentCode,
}: {
  config: GetConfigResultData | null;
  setIsNotificationsOpen: (isOpen: boolean) => void;
  activeUnitId: string | null;
  departmentCode: string | undefined;
}) => {
  if (!activeUnitId || !config || !config.NovuApplicationId || !config.NovuBackendApiUrl || !config.NovuSocketUrl || !departmentCode) {
    return null;
  }

  return (
    <NovuProvider subscriberId={`${departmentCode}_Unit_${activeUnitId}`} applicationIdentifier={config.NovuApplicationId} backendUrl={config.NovuBackendApiUrl} socketUrl={config.NovuSocketUrl}>
      <NotificationButton onPress={() => setIsNotificationsOpen(true)} />
    </NovuProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
