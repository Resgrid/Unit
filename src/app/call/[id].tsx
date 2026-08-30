import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardListIcon, ClockIcon, FileTextIcon, ImageIcon, InfoIcon, LoaderIcon, MapPinIcon, NavigationIcon, PaperclipIcon, RouteIcon, TimerIcon, UserIcon, UsersIcon, VideoIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { VideoFeedTabContent } from '@/components/call-video-feeds/video-feed-tab-content';
import { CheckInTabContent } from '@/components/check-in-timers/check-in-tab-content';
import { ProtectedRevealBar } from '@/components/data-protection/protected-reveal-bar';
import { ProtectedText } from '@/components/data-protection/protected-text';
import { isFieldRedacted, ProtectedFieldIds } from '@/lib/data-protection/redacted';
import { HeaderBackButton } from '@/components/common/header-back-button';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { IncidentCommandTabPanel } from '@/components/incident-command/incident-command-tab-panel';
import { FullScreenMap } from '@/components/maps/full-screen-map';
// Import a static map component instead of react-native-maps
import StaticMap from '@/components/maps/static-map';
import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { HtmlRenderer } from '@/components/ui/html-renderer';
import { SharedTabs, type TabItem } from '@/components/ui/shared-tabs';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { getUnitTypeCheckInBadge } from '@/lib/check-in-timer-utils';
import { logger } from '@/lib/logging';
import { openMapsWithDirections } from '@/lib/navigation';
import { parseApiUtcDate, safeFormatDate } from '@/lib/utils';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { securityStore } from '@/stores/security/store';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { useToastStore } from '@/stores/toast/store';

import { useCallDetailMenu } from '../../components/calls/call-detail-menu';
import CallFilesModal from '../../components/calls/call-files-modal';
import CallImagesModal from '../../components/calls/call-images-modal';
import CallNotesModal from '../../components/calls/call-notes-modal';
import { CloseCallBottomSheet } from '../../components/calls/close-call-bottom-sheet';

export default function CallDetail() {
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [coordinates, setCoordinates] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });
  const call = useCallDetailStore((state) => state.call);
  const callExtraData = useCallDetailStore((state) => state.callExtraData);
  const callPriority = useCallDetailStore((state) => state.callPriority);
  const isLoading = useCallDetailStore((state) => state.isLoading);
  const error = useCallDetailStore((state) => state.error);
  const fetchCallDetail = useCallDetailStore((state) => state.fetchCallDetail);
  const reset = useCallDetailStore((state) => state.reset);
  const canUserCreateCalls = securityStore((state) => state.rights?.CanCreateCalls);
  const activeCall = useCoreStore((state) => state.activeCall);
  const activeStatuses = useCoreStore((state) => state.activeStatuses);
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const setStatusBottomSheetOpen = useStatusBottomSheetStore((state) => state.setIsOpen);
  const setSelectedCall = useStatusBottomSheetStore((state) => state.setSelectedCall);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isCloseCallModalOpen, setIsCloseCallModalOpen] = useState(false);
  const [isSettingActive, setIsSettingActive] = useState(false);
  const [mapTarget, setMapTarget] = useState<'call' | 'destination'>('call');
  const [isFullScreenMapOpen, setIsFullScreenMapOpen] = useState(false);
  const showToast = useToastStore((state) => state.showToast);
  const timerStatuses = useCheckInTimerStore((state) => state.timerStatuses);
  const startPolling = useCheckInTimerStore((state) => state.startPolling);
  const stopPolling = useCheckInTimerStore((state) => state.stopPolling);
  const resetTimers = useCheckInTimerStore((state) => state.reset);

  // NOTE: the user's location is read via useLocationStore.getState() inside the
  // route handlers instead of subscribing — subscribing re-rendered this whole
  // screen (tab tree + WebViews) on every GPS fix.

  const handleBack = () => {
    router.back();
  };

  const openNotesModal = () => {
    useCallDetailStore.getState().fetchCallNotes(callId);
    setIsNotesModalOpen(true);
  };

  const openImagesModal = () => {
    setIsImagesModalOpen(true);
  };

  const openFilesModal = () => {
    setIsFilesModalOpen(true);
  };

  const handleEditCall = useCallback(() => {
    router.push(`/call/${callId}/edit`);
  }, [router, callId]);

  const handleCloseCall = useCallback(() => {
    setIsCloseCallModalOpen(true);
  }, []);

  const handleShowCallOnMap = useCallback(() => {
    setMapTarget('call');
  }, []);

  const handleShowDestinationOnMap = useCallback(() => {
    setMapTarget('destination');
  }, []);

  const handleOpenFullScreenMap = useCallback(() => {
    setIsFullScreenMapOpen(true);
  }, []);

  const handleCloseFullScreenMap = useCallback(() => {
    setIsFullScreenMapOpen(false);
  }, []);

  const handleSetActive = async () => {
    if (!call) return;

    setIsSettingActive(true);

    try {
      // Set this call as the active call in the core store
      await useCoreStore.getState().setActiveCall(call.CallId);

      // Pre-select the current call and open the status bottom sheet without a pre-selected status
      setSelectedCall(call);
      setStatusBottomSheetOpen(true); // No status provided, will start with status selection

      // Show success message
      showToast('success', t('call_detail.set_active_success'));
    } catch (error) {
      logger.error({
        message: 'Failed to set call as active',
        context: { error, callId: call.CallId },
      });
      showToast('error', t('call_detail.set_active_error'));
    } finally {
      setIsSettingActive(false);
    }
  };

  // Initialize the call detail menu hook
  const { HeaderRightMenu, CallDetailActionSheet } = useCallDetailMenu({
    onEditCall: handleEditCall,
    onCloseCall: handleCloseCall,
    canUserCreateCalls,
  });

  useEffect(() => {
    reset();
    if (callId) {
      fetchCallDetail(callId);
    }
  }, [callId, fetchCallDetail, reset]);

  useEffect(() => {
    if (call) {
      // Try Latitude/Longitude first, but validate they are real coordinates
      if (call.Latitude && call.Longitude) {
        const lat = parseFloat(call.Latitude);
        const lng = parseFloat(call.Longitude);
        if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
          setCoordinates({ latitude: lat, longitude: lng });
          return;
        }
      }

      // Fall through to Geolocation if Latitude/Longitude are missing or invalid
      if (call.Geolocation) {
        const parts = call.Geolocation.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0].trim());
          const lng = parseFloat(parts[1].trim());
          if (!isNaN(lat) && !isNaN(lng)) {
            setCoordinates({ latitude: lat, longitude: lng });
          }
        }
      }
    }
  }, [call]);

  // Track when call detail view is rendered
  useEffect(() => {
    if (call) {
      trackEvent('call_detail_view_rendered', {
        callId: call.CallId || '',
        callName: call.Name || '',
        callNumber: call.Number || '',
        callPriority: call.Priority || 0,
        callType: call.Type || '',
        hasCoordinates: !!(call.Latitude && call.Longitude),
        hasAddress: !!call.Address,
        hasNotes: (call.NotesCount || 0) > 0,
        hasImages: (call.ImgagesCount || 0) > 0,
        hasFiles: (call.FileCount || 0) > 0,
        hasExtraData: !!callExtraData,
        hasProtocols: !!callExtraData?.Protocols?.length,
        hasDispatches: !!callExtraData?.Dispatches?.length,
        hasTimeline: !!callExtraData?.Activity?.length,
      });
    }
  }, [trackEvent, call, callExtraData]);

  // Check-in timer polling lifecycle
  useEffect(() => {
    if (call?.CheckInTimersEnabled) {
      startPolling(parseInt(call.CallId, 10), 30000);
    }
    return () => {
      stopPolling();
      resetTimers();
    };
  }, [call?.CheckInTimersEnabled, call?.CallId, startPolling, stopPolling, resetTimers]);

  /**
   * Opens the device's native maps application with directions to the call location
   */
  const handleRoute = async () => {
    if (coordinates.latitude === null || coordinates.longitude === null) {
      showToast('error', t('call_detail.no_location_for_routing'));
      return;
    }

    try {
      const destinationName = call?.Address || t('call_detail.call_location');
      const { latitude: userLatitude, longitude: userLongitude } = useLocationStore.getState();
      const success = await openMapsWithDirections(coordinates.latitude, coordinates.longitude, destinationName, userLatitude || undefined, userLongitude || undefined);

      if (!success) {
        showToast('error', t('call_detail.failed_to_open_maps'));
      }
    } catch (error) {
      logger.error({
        message: 'Failed to open maps for routing',
        context: { error, callId, coordinates },
      });
      showToast('error', t('call_detail.failed_to_open_maps'));
    }
  };

  /**
   * Opens the device's native maps application with directions to the call's destination POI.
   */
  const handleRouteToDestination = async () => {
    const latitude = call?.DestinationLatitude;
    const longitude = call?.DestinationLongitude;

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      showToast('error', t('call_detail.no_location_for_routing'));
      return;
    }

    try {
      const destinationName = call?.DestinationName || call?.DestinationAddress || t('call_detail.destination');
      const { latitude: userLatitude, longitude: userLongitude } = useLocationStore.getState();
      const success = await openMapsWithDirections(latitude, longitude, destinationName, userLatitude || undefined, userLongitude || undefined);

      if (!success) {
        showToast('error', t('call_detail.failed_to_open_maps'));
      }
    } catch (error) {
      logger.error({
        message: 'Failed to open maps for destination routing',
        context: { error, callId, destination: { latitude, longitude } },
      });
      showToast('error', t('call_detail.failed_to_open_maps'));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
            headerRight: HeaderRightMenu,
            headerBackTitle: '',
            headerLeft: () => <HeaderBackButton onPress={handleBack} />,
          }}
        />
        <View className="size-full flex-1">
          <FocusAwareStatusBar hidden={true} />
          <Loading />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
            headerRight: HeaderRightMenu,
            headerBackTitle: '',
            headerLeft: () => <HeaderBackButton onPress={handleBack} />,
          }}
        />
        <View className="size-full flex-1">
          <FocusAwareStatusBar hidden={true} />
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <ZeroState heading={t('call_detail.not_found')} description={error} isError={true} />
          </Box>
        </View>
      </>
    );
  }

  if (!call) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
            headerBackTitle: '',
            headerLeft: () => <HeaderBackButton onPress={handleBack} />,
          }}
        />
        <SafeAreaView className="size-full flex-1">
          <FocusAwareStatusBar hidden={true} />
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <Text className="text-center">{t('call_detail.not_found')}</Text>
            <Button onPress={handleBack} className="self-center">
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </Box>
        </SafeAreaView>
      </>
    );
  }

  const renderTabs = () => {
    const destinationLabel = call.DestinationName || call.DestinationAddress || '';
    const tabs: TabItem[] = [
      {
        key: 'info',
        title: t('call_detail.tabs.info'),
        icon: <InfoIcon size={16} />,
        content: (
          <Box className="p-4">
            <VStack className="space-y-3">
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.priority')}</Text>
                <Text className="font-medium" style={{ color: callPriority?.Color }}>
                  {callPriority?.Name}
                </Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.timestamp')}</Text>
                <Text className="font-medium">{safeFormatDate(parseApiUtcDate(call.LoggedOnUtc) ?? call.LoggedOn, 'MMM d, h:mm a')}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.type')}</Text>
                <Text className="font-medium">{call.Type}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.address')}</Text>
                <ProtectedText value={call.Address} fieldId={ProtectedFieldIds.callAddress} redactedFields={call.RedactedFields} className="font-medium" />
              </Box>
              {destinationLabel ? (
                <Box className="border-b border-outline-100 pb-2">
                  <Text className="text-sm text-gray-500">{t('call_detail.destination')}</Text>
                  <Text className="font-medium">{destinationLabel}</Text>
                  {call.DestinationTypeName || call.DestinationAddress ? <Text className="text-sm text-gray-500">{[call.DestinationTypeName, call.DestinationAddress].filter(Boolean).join(' - ')}</Text> : null}
                </Box>
              ) : null}
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.note')}</Text>
                <Box>
                  {/*
                    A withheld note is not empty HTML — rendering the sentinel through the HTML
                    renderer would print the bare word REDACTED in the body copy, which reads as
                    the note's content rather than as an absence.
                  */}
                  {isFieldRedacted(call.RedactedFields, ProtectedFieldIds.callNotes, call.Note) ? (
                    <ProtectedText value={call.Note} fieldId={ProtectedFieldIds.callNotes} redactedFields={call.RedactedFields} />
                  ) : (
                    <HtmlRenderer html={call.Note ?? ''} style={StyleSheet.flatten([styles.container, { height: 200 }])} />
                  )}
                </Box>
              </Box>
            </VStack>
          </Box>
        ),
      },
      {
        key: 'contact',
        title: t('call_detail.tabs.contact'),
        icon: <UserIcon size={16} />,
        content: (
          <Box className="p-4">
            <VStack className="space-y-3">
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.reference_id')}</Text>
                <Text className="font-medium">{call.ReferenceId}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.external_id')}</Text>
                <Text className="font-medium">{call.ExternalId}</Text>
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.contact_name')}</Text>
                <ProtectedText value={call.ContactName} fieldId={ProtectedFieldIds.callContactName} redactedFields={call.RedactedFields} className="font-medium" />
              </Box>
              <Box className="border-b border-outline-100 pb-2">
                <Text className="text-sm text-gray-500">{t('call_detail.contact_info')}</Text>
                <ProtectedText value={call.ContactInfo} fieldId={ProtectedFieldIds.callContactNumber} redactedFields={call.RedactedFields} className="font-medium" />
              </Box>
            </VStack>
          </Box>
        ),
      },
      {
        key: 'protocols',
        title: t('call_detail.tabs.protocols'),
        icon: <FileTextIcon size={16} />,
        content: (
          <Box className="p-4">
            {callExtraData?.Protocols && callExtraData.Protocols.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Protocols.map((protocol, index) => (
                  <Box key={index} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                    <Text className="font-semibold">{protocol.Name}</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400">{protocol.Description}</Text>
                    <Box>
                      <HtmlRenderer html={protocol.ProtocolText ?? ''} style={StyleSheet.flatten([styles.container, { height: 200 }])} />
                    </Box>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_protocols')}</Text>
            )}
          </Box>
        ),
      },
      {
        key: 'dispatched',
        title: t('call_detail.tabs.dispatched'),
        icon: <UsersIcon size={16} />,
        content: (
          <Box className="p-4">
            {callExtraData?.Dispatches && callExtraData.Dispatches.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Dispatches.map((dispatched, index) => (
                  <Box key={index} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                    <Text className="font-semibold">{dispatched.Name}</Text>
                    <HStack className="mt-1">
                      <Text className="mr-2 text-sm text-gray-600">
                        {t('call_detail.group')}: {dispatched.Group}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {t('call_detail.type')}: {dispatched.Type}
                      </Text>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_dispatched')}</Text>
            )}
          </Box>
        ),
      },
      {
        key: 'timeline',
        title: t('call_detail.tabs.timeline'),
        icon: <ClockIcon size={16} />,
        badge: callExtraData?.Activity?.length || 0,
        content: (
          <Box className="p-4">
            {callExtraData?.Activity && callExtraData.Activity.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Activity.map((event, index) => (
                  <Box key={index} className="border-l-4 border-blue-500 py-1 pl-3">
                    <Text className="font-semibold" style={{ color: event.StatusColor }}>
                      {event.StatusText}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {event.Name} - {event.Group}
                    </Text>
                    <Text className="text-xs text-gray-500">{new Date(event.Timestamp).toLocaleString()}</Text>
                    <Text className="text-xs text-gray-500">{event.Note}</Text>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_timeline')}</Text>
            )}
          </Box>
        ),
      },
    ];

    // Incident command tab
    tabs.push({
      key: 'command',
      title: t('incident_command.tab_title'),
      icon: <ClipboardListIcon size={16} />,
      content: <IncidentCommandTabPanel callId={call.CallId} />,
    });

    // Video feeds tab
    tabs.push({
      key: 'video',
      title: t('video_feeds.tab_title'),
      icon: <VideoIcon size={16} />,
      content: <VideoFeedTabContent callId={parseInt(call.CallId, 10)} />,
    });

    // Conditionally add check-in tab
    if (call?.CheckInTimersEnabled) {
      const checkInBadge = getUnitTypeCheckInBadge(timerStatuses, {
        currentUnitTypeId: activeUnit?.TypeId,
        hasCurrentUser: true,
      });
      tabs.push({
        key: 'checkin',
        title: t('check_in.tab_title'),
        icon: <TimerIcon size={16} />,
        badge: checkInBadge?.count,
        badgeVariant: checkInBadge?.variant,
        content: <CheckInTabContent callId={parseInt(call.CallId, 10)} />,
      });
    }

    return tabs;
  };

  // Destination POI coordinates (if the call has a destination POI) and the
  // currently displayed map target (call/dispatch location vs. destination).
  const destinationLatitude = call.DestinationLatitude ?? null;
  const destinationLongitude = call.DestinationLongitude ?? null;
  const hasDestinationCoordinates = destinationLatitude !== null && destinationLongitude !== null && (destinationLatitude !== 0 || destinationLongitude !== 0);
  const hasCallCoordinates = coordinates.latitude !== null && coordinates.longitude !== null;
  const showingDestination = hasDestinationCoordinates && (mapTarget === 'destination' || !hasCallCoordinates);
  const mapLatitude = showingDestination ? destinationLatitude : coordinates.latitude;
  const mapLongitude = showingDestination ? destinationLongitude : coordinates.longitude;
  const mapAddress = showingDestination ? call.DestinationAddress || call.DestinationName || '' : call.Address;
  const mapTitle = showingDestination ? call.DestinationName || t('call_detail.destination') : call.Name || t('call_detail.call_location');

  return (
    <>
      <Stack.Screen
        options={{
          title: t('call_detail.title'),
          headerShown: true,
          headerRight: HeaderRightMenu,
          headerBackTitle: '',
          headerLeft: () => <HeaderBackButton onPress={handleBack} />,
        }}
      />
      <ScrollView className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900" contentContainerStyle={{ paddingBottom: 16 }}>
        {/*
          Protected values (call name, nature, notes, address, contact details) arrive REDACTED and
          only come back decrypted on a request carrying a grant, so revealing has to re-read the
          call. Renders nothing for a department without the addon.
        */}
        <ProtectedRevealBar onRefresh={() => fetchCallDetail(callId)} />

        {/* Header */}
        <Box className="mx-4 mt-3 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
          <HStack className="mb-2 items-center justify-between">
            <Heading size="md">
              {/* The call NUMBER is not cataloged, so it stays visible and the record stays findable. */}
              {isFieldRedacted(call.RedactedFields, ProtectedFieldIds.callName, call.Name) ? (
                <ProtectedText value={call.Name} fieldId={ProtectedFieldIds.callName} redactedFields={call.RedactedFields} />
              ) : (
                <>
                  {call.Name} ({call.Number})
                </>
              )}
            </Heading>
            {/* Show "Set Active" button if this call is not the active call and there is an active unit */}
            {activeUnit && activeCall?.CallId !== call.CallId ? (
              <Button variant="solid" size="sm" onPress={handleSetActive} disabled={isSettingActive} className={`${isSettingActive ? 'bg-primary-400 opacity-80' : 'bg-primary-500'} shadow-lg`}>
                {isSettingActive ? <ButtonIcon as={LoaderIcon} className="mr-1 animate-spin text-white" /> : null}
                <ButtonText className="font-medium text-white">{isSettingActive ? t('call_detail.setting_active') : t('call_detail.set_active')}</ButtonText>
              </Button>
            ) : null}
          </HStack>
          <VStack className="space-y-1">
            <ScrollView style={{ height: 180 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
              {isFieldRedacted(call.RedactedFields, ProtectedFieldIds.callNature, call.Nature) ? (
                <ProtectedText value={call.Nature} fieldId={ProtectedFieldIds.callNature} redactedFields={call.RedactedFields} />
              ) : (
                <HtmlRenderer html={call.Nature ?? ''} style={StyleSheet.flatten([styles.container, { minHeight: 170 }])} />
              )}
            </ScrollView>
          </VStack>
        </Box>

        {/* Map - only show when valid coordinates exist */}
        {mapLatitude !== null && mapLongitude !== null ? (
          <>
            <Box className="mx-4 mt-3 overflow-hidden rounded-xl shadow-xs">
              <Pressable onPress={handleOpenFullScreenMap} accessibilityRole="button" accessibilityLabel={t('calls.view_on_map')} accessibilityHint={t('accessibility.action.address')} testID="call-detail-static-map">
                <StaticMap latitude={mapLatitude} longitude={mapLongitude} address={mapAddress} zoom={15} height={200} showUserLocation={true} />
              </Pressable>
              {/* Toggle the map between the call (dispatch) location and the destination POI */}
              {hasDestinationCoordinates ? (
                <HStack className="w-full">
                  <Button onPress={handleShowCallOnMap} variant={showingDestination ? 'outline' : 'solid'} size="sm" className="flex-1 rounded-none" testID="call-detail-map-toggle-call">
                    <ButtonIcon as={MapPinIcon} />
                    <ButtonText className="text-xs">{t('call_detail.call_location')}</ButtonText>
                  </Button>
                  <Button onPress={handleShowDestinationOnMap} variant={showingDestination ? 'solid' : 'outline'} size="sm" className="flex-1 rounded-none" testID="call-detail-map-toggle-destination">
                    <ButtonIcon as={NavigationIcon} />
                    <ButtonText className="text-xs">{t('call_detail.destination')}</ButtonText>
                  </Button>
                </HStack>
              ) : null}
            </Box>
            <FullScreenMap isOpen={isFullScreenMapOpen} latitude={mapLatitude} longitude={mapLongitude} title={mapTitle} address={mapAddress} onClose={handleCloseFullScreenMap} />
          </>
        ) : null}

        {/* Action Buttons */}
        <HStack className="mx-4 mt-3 justify-around rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
          <Box className="relative mx-1 flex-1">
            <Button onPress={() => openNotesModal()} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={FileTextIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.notes')}</ButtonText>
            </Button>
            {call?.NotesCount ? (
              <Box className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-xs font-medium text-white">{call.NotesCount}</Text>
              </Box>
            ) : null}
          </Box>
          <Box className="relative mx-1 flex-1">
            <Button onPress={openImagesModal} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={ImageIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.images')}</ButtonText>
            </Button>
            {call?.ImgagesCount ? (
              <Box className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-xs font-medium text-white">{call.ImgagesCount}</Text>
              </Box>
            ) : null}
          </Box>
          <Box className="relative mx-1 flex-1">
            <Button onPress={openFilesModal} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={PaperclipIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.files.button')}</ButtonText>
            </Button>
            {call?.FileCount ? (
              <Box className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-xs font-medium text-white">{call.FileCount}</Text>
              </Box>
            ) : null}
          </Box>
          <Box className="relative mx-1 flex-1">
            <Button onPress={handleRoute} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'}>
              <ButtonIcon as={RouteIcon} />
              <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('common.route')}</ButtonText>
            </Button>
          </Box>
          {hasDestinationCoordinates ? (
            <Box className="relative mx-1 flex-1">
              <Button onPress={handleRouteToDestination} variant="outline" className="w-full" size={isLandscape ? 'md' : 'sm'} testID="call-detail-route-destination-button">
                <ButtonIcon as={NavigationIcon} />
                <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.destination')}</ButtonText>
              </Button>
            </Box>
          ) : null}
        </HStack>

        {/* Tabs */}
        <Box className="mx-4 mt-3 flex-1 overflow-hidden rounded-xl bg-white pb-8 shadow-xs dark:bg-gray-800">
          <SharedTabs tabs={renderTabs()} variant="underlined" size={isLandscape ? 'lg' : 'md'} tabClassName="min-h-11" showOverflowIndicators />
        </Box>
      </ScrollView>
      <CallNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} callId={callId} />
      <CallImagesModal isOpen={isImagesModalOpen} onClose={() => setIsImagesModalOpen(false)} callId={callId} />
      <CallFilesModal isOpen={isFilesModalOpen} onClose={() => setIsFilesModalOpen(false)} callId={callId} />

      {/* Close Call Bottom Sheet */}
      <CloseCallBottomSheet isOpen={isCloseCallModalOpen} onClose={() => setIsCloseCallModalOpen(false)} callId={callId} />

      {/* Call Detail Menu ActionSheet */}
      <CallDetailActionSheet />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
