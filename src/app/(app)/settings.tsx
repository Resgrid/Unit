/* eslint-disable react/react-in-jsx-scope */
import { Env } from '@env';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { BackgroundGeolocationItem } from '@/components/settings/background-geolocation-item';
import { BluetoothDeviceItem } from '@/components/settings/bluetooth-device-item';
import { Item } from '@/components/settings/item';
import { KeepAliveItem } from '@/components/settings/keep-alive-item';
import { LanguageItem } from '@/components/settings/language-item';
import { LoginInfoBottomSheet } from '@/components/settings/login-info-bottom-sheet';
import { ServerUrlBottomSheet } from '@/components/settings/server-url-bottom-sheet';
import { ThemeItem } from '@/components/settings/theme-item';
import { ToggleItem } from '@/components/settings/toggle-item';
import { UnitSelectionBottomSheet } from '@/components/settings/unit-selection-bottom-sheet';
import { FocusAwareStatusBar, ScrollView } from '@/components/ui';
import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuth, useAuthStore } from '@/lib';
import { logger } from '@/lib/logging';
import { storage } from '@/lib/storage';
import { getBaseApiUrl, removeActiveCallId, removeActiveUnitId, removeDeviceUuid } from '@/lib/storage/app';
import { openLinkInBrowser } from '@/lib/utils';
import { useAudioStreamStore } from '@/stores/app/audio-stream-store';
import { useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import { useCoreStore } from '@/stores/app/core-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';
import { useLoadingStore } from '@/stores/app/loading-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useCallsStore } from '@/stores/calls/store';
import { useContactsStore } from '@/stores/contacts/store';
import { useDispatchStore } from '@/stores/dispatch/store';
import { useNotesStore } from '@/stores/notes/store';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';
import { useProtocolsStore } from '@/stores/protocols/store';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { useUnitsStore } from '@/stores/units/store';

export default function Settings() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const signOut = useAuthStore.getState().logout;
  const { colorScheme } = useColorScheme();
  const [showLoginInfo, setShowLoginInfo] = React.useState(false);
  const { login, status, isAuthenticated } = useAuth();
  const [showServerUrl, setShowServerUrl] = React.useState(false);
  const [showUnitSelection, setShowUnitSelection] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const { units } = useUnitsStore();

  const activeUnitName = React.useMemo(() => {
    if (!activeUnit) return t('settings.none_selected');
    return activeUnit?.Name || t('common.unknown');
  }, [activeUnit, t]);

  /**
   * Clears all app data, cached values, settings, and stores
   * Called when user confirms logout
   */
  const clearAllAppData = useCallback(async () => {
    logger.info({
      message: 'Clearing all app data on logout',
    });

    try {
      // Clear persisted storage items
      removeActiveUnitId();
      removeActiveCallId();
      removeDeviceUuid();

      // Clear all MMKV storage except first time flag and user preferences
      const allKeys = storage.getAllKeys();
      const keysToPreserve = ['IS_FIRST_TIME'];
      allKeys.forEach((key) => {
        if (!keysToPreserve.includes(key)) {
          storage.delete(key);
        }
      });

      // Reset all zustand stores to their initial states
      // Core stores
      useCoreStore.setState({
        activeUnitId: null,
        activeUnit: null,
        activeUnitStatus: null,
        activeUnitStatusType: null,
        activeCallId: null,
        activeCall: null,
        activePriority: null,
        config: null,
        isLoading: false,
        isInitialized: false,
        isInitializing: false,
        error: null,
        activeStatuses: null,
      });

      // Calls store
      useCallsStore.setState({
        calls: [],
        callPriorities: [],
        callTypes: [],
        isLoading: false,
        error: null,
      });

      // Units store
      useUnitsStore.setState({
        units: [],
        unitStatuses: [],
        isLoading: false,
        error: null,
      });

      // Contacts store
      useContactsStore.setState({
        contacts: [],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        isNotesLoading: false,
        error: null,
      });

      // Notes store
      useNotesStore.setState({
        notes: [],
        searchQuery: '',
        selectedNoteId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
      });

      // Roles store
      useRolesStore.setState({
        roles: [],
        unitRoleAssignments: [],
        users: [],
        isLoading: false,
        error: null,
      });

      // Protocols store
      useProtocolsStore.setState({
        protocols: [],
        searchQuery: '',
        selectedProtocolId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
      });

      // Dispatch store
      useDispatchStore.setState({
        data: {
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
        selection: {
          everyone: false,
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
        isLoading: false,
        error: null,
        searchQuery: '',
      });

      // Security store
      securityStore.setState({
        error: null,
        rights: null,
      });

      // Status bottom sheet store
      useStatusBottomSheetStore.getState().reset();

      // Offline queue store
      useOfflineQueueStore.getState().clearAllEvents();

      // Loading store
      useLoadingStore.getState().resetLoading();

      // Location store
      useLocationStore.setState({
        latitude: null,
        longitude: null,
        heading: null,
        accuracy: null,
        speed: null,
        altitude: null,
        timestamp: null,
      });

      // LiveKit store - disconnect and reset
      const liveKitState = useLiveKitStore.getState();
      if (liveKitState.isConnected) {
        liveKitState.disconnectFromRoom();
      }
      useLiveKitStore.setState({
        isConnected: false,
        isConnecting: false,
        currentRoom: null,
        currentRoomInfo: null,
        isTalking: false,
        availableRooms: [],
        isBottomSheetVisible: false,
      });

      // Audio stream store - cleanup and reset
      const audioStreamState = useAudioStreamStore.getState();
      await audioStreamState.cleanup();
      useAudioStreamStore.setState({
        availableStreams: [],
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
        isBottomSheetVisible: false,
      });

      // Bluetooth audio store
      useBluetoothAudioStore.setState({
        connectedDevice: null,
        isScanning: false,
        isConnecting: false,
        availableDevices: [],
        connectionError: null,
        isAudioRoutingActive: false,
      });

      // Push notification modal store
      usePushNotificationModalStore.setState({
        isOpen: false,
        notification: null,
      });

      logger.info({
        message: 'Successfully cleared all app data',
      });
    } catch (error) {
      logger.error({
        message: 'Error clearing app data on logout',
        context: { error },
      });
    }
  }, []);

  /**
   * Handles logout confirmation - clears all data and signs out
   */
  const handleLogoutConfirm = useCallback(async () => {
    setShowLogoutConfirm(false);

    trackEvent('user_logout_confirmed', {
      hadActiveUnit: !!activeUnit,
    });

    // Clear all app data first
    await clearAllAppData();

    // Then sign out
    await signOut();
  }, [clearAllAppData, signOut, trackEvent, activeUnit]);

  const handleLoginInfoSubmit = async (data: { username: string; password: string }) => {
    logger.info({
      message: 'Updating login info',
    });
    await login({ username: data.username, password: data.password });
  };

  useEffect(() => {
    if (status === 'signedIn' && isAuthenticated) {
      logger.info({
        message: 'Setting Login info successful',
      });
    }
  }, [status, isAuthenticated]);

  // Track when settings view is rendered
  useEffect(() => {
    trackEvent('settings_view_rendered', {
      hasActiveUnit: !!activeUnit,
      unitName: activeUnit?.Name || 'none',
    });
  }, [trackEvent, activeUnit]);

  return (
    <Box className={`flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <FocusAwareStatusBar />
      <ScrollView>
        <VStack className="md p-4">
          {/* App Info Section */}
          <Card className={`mb-4 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.app_info')}</Heading>
            <VStack space="sm">
              <Item text={t('settings.app_name')} value={Env.NAME} />
              <Item text={t('settings.version')} value={Env.VERSION} />
              <Item text={t('settings.environment')} value={Env.APP_ENV} />
            </VStack>
          </Card>

          {/* Account Section */}
          <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.account')}</Heading>
            <VStack space="sm">
              <Item text={t('settings.server')} value={getBaseApiUrl()} onPress={() => setShowServerUrl(true)} textStyle="text-info-600" />
              <Item text={t('settings.login_info')} onPress={() => setShowLoginInfo(true)} textStyle="text-info-600" />
              <Item text={t('settings.active_unit')} value={activeUnitName} onPress={() => setShowUnitSelection(true)} textStyle="text-info-600" />
              <Item text={t('settings.logout')} onPress={() => setShowLogoutConfirm(true)} textStyle="text-error-600" />
            </VStack>
          </Card>

          {/* Preferences Section */}
          <Card className={`mb-4 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.preferences')}</Heading>
            <VStack space="sm">
              <ThemeItem />
              <LanguageItem />
              <KeepAliveItem />
              <BackgroundGeolocationItem />
              <BluetoothDeviceItem />
            </VStack>
          </Card>

          {/* Support Section */}
          <Card className={`mb-4 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.support')}</Heading>
            <VStack space="sm">
              <Item text={t('settings.help_center')} onPress={() => openLinkInBrowser('https://resgrid.zohodesk.com/portal/en/home')} />
              <Item text={t('settings.contact_us')} onPress={() => openLinkInBrowser('https://resgrid.com/contact')} />
              <Item text={t('settings.status_page')} onPress={() => openLinkInBrowser('https://resgrid.freshstatus.io')} />
              <Item text={t('settings.privacy_policy')} onPress={() => openLinkInBrowser('https://resgrid.com/privacy')} />
              <Item text={t('settings.terms')} onPress={() => openLinkInBrowser('https://resgrid.com/terms')} />
            </VStack>
          </Card>
        </VStack>
      </ScrollView>

      <LoginInfoBottomSheet isOpen={showLoginInfo} onClose={() => setShowLoginInfo(false)} onSubmit={handleLoginInfoSubmit} />
      <ServerUrlBottomSheet isOpen={showServerUrl} onClose={() => setShowServerUrl(false)} />
      <UnitSelectionBottomSheet isOpen={showUnitSelection} onClose={() => setShowUnitSelection(false)} />

      {/* Logout Confirmation Dialog */}
      <AlertDialog isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="lg">{t('settings.logout_confirm_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text>{t('settings.logout_confirm_message')}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" action="secondary" onPress={() => setShowLogoutConfirm(false)}>
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button action="negative" onPress={handleLogoutConfirm}>
              <ButtonText>{t('settings.logout')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
