/* eslint-disable react/no-unstable-nested-components */
import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
import { Contact, ListTree, Map, Megaphone, Menu, Notebook, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions } from 'react-native';

import Sidebar from '@/components/sidebar/sidebar';
import { Pressable, View } from '@/components/ui';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Drawer, DrawerBackdrop, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/auth';
import { useIsFirstTime } from '@/lib/storage';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useRolesStore } from '@/stores/roles/store';

export default function TabLayout() {
  const { t } = useTranslation();
  const status = useAuthStore().status;
  const [isFirstTime, setIsFirstTime] = useIsFirstTime();
  const [isOpen, setIsOpen] = React.useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);
  const parentRef = useRef(null);

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
    }
  }, [hideSplash, status]);

  // Force drawer open in landscape
  useEffect(() => {
    if (isLandscape) {
      setIsOpen(true);
    }
  }, [isLandscape]);

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  return (
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
              }}
            />

            <Tabs.Screen
              name="calls"
              options={{
                title: t('tabs.calls'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={Megaphone} stroke={color} className="text-primary-500 dark:text-primary-400" />,
                tabBarButtonTestID: 'calls-tab',
              }}
            />

            <Tabs.Screen
              name="contacts"
              options={{
                title: t('tabs.contacts'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={Contact} stroke={color} className="text-primary-500 dark:text-primary-400" />,
                tabBarButtonTestID: 'contacts-tab',
              }}
            />

            <Tabs.Screen
              name="notes"
              options={{
                title: t('tabs.notes'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={Notebook} stroke={color} />,
                tabBarButtonTestID: 'notes-tab',
              }}
            />

            <Tabs.Screen
              name="protocols"
              options={{
                title: t('tabs.protocols'),
                headerShown: true,
                tabBarIcon: ({ color }) => <Icon as={ListTree} stroke={color} />,
                tabBarButtonTestID: 'protocols-tab',
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
}

const CreateNewPostLink = () => {
  return (
    <Link href="/feed/add-post" asChild>
      <Pressable>
        <Text className="px-3 text-primary-300">Create</Text>
      </Pressable>
    </Link>
  );
};

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
