import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, CircleX, Eye, MapPin, Navigation } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { openMapsWithAddress, openMapsWithDirections } from '@/lib/navigation';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';

import { CallCard } from '../calls/call-card';
import { Button, ButtonIcon, ButtonText } from '../ui/button';
import { Card } from '../ui/card';
import { HStack } from '../ui/hstack';

export const SidebarCallCard = () => {
  const { colorScheme } = useColorScheme();
  const activeCall = useCoreStore((state) => state.activeCall);
  const activePriority = useCoreStore((state) => state.activePriority);
  const setActiveCall = useCoreStore((state) => state.setActiveCall);

  const [isBottomSheetOpen, setIsBottomSheetOpen] = React.useState(false);
  const { t } = useTranslation();

  // Fetch calls data when bottom sheet opens.
  // The store swallows fetch failures into its own `error` field and never rejects, so
  // the query has to read that field and throw — otherwise a failed load rendered an
  // empty sheet that looked like "there are no open calls".
  const {
    data: openCallsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['calls', 'open'],
    queryFn: async () => {
      // Only fetch when bottom sheet is open
      if (!isBottomSheetOpen) return [];
      await useCallsStore.getState().fetchCalls(true);
      const { calls, error } = useCallsStore.getState();
      if (error) {
        throw new Error(error);
      }
      return calls;
    },
    enabled: isBottomSheetOpen, // Only run query when bottom sheet is open
  });

  const handleRetry = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleDeselect = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${t('calls.confirm_deselect_title')}\n${t('calls.confirm_deselect_message')}`);
      if (confirmed) {
        setActiveCall(null);
      }
      return;
    }

    Alert.alert(
      t('calls.confirm_deselect_title'),
      t('calls.confirm_deselect_message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.confirm'),
          onPress: () => setActiveCall(null),
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  // Check if location data exists (either coordinates or address)
  const hasLocationData = (call: typeof activeCall) => {
    if (!call) return false;
    const hasCoordinates = call.Latitude && call.Longitude;
    const hasAddress = call.Address && call.Address.trim() !== '';
    return hasCoordinates || hasAddress;
  };

  const showLocationAlert = () => {
    if (Platform.OS === 'web') {
      window.alert(`${t('calls.no_location_title')}\n${t('calls.no_location_message')}`);
    } else {
      Alert.alert(t('calls.no_location_title'), t('calls.no_location_message'), [{ text: t('common.ok') }]);
    }
  };

  const handleDirections = async () => {
    if (!activeCall) return;

    const latitude = activeCall.Latitude;
    const longitude = activeCall.Longitude;
    const address = activeCall.Address;

    // Check if we have coordinates
    if (latitude && longitude) {
      try {
        const opened = await openMapsWithDirections(latitude, longitude, address);
        if (!opened) {
          showLocationAlert();
        }
      } catch {
        showLocationAlert();
      }
    } else if (address && address.trim() !== '') {
      // Fall back to address if no coordinates
      try {
        const opened = await openMapsWithAddress(address);
        if (!opened) {
          showLocationAlert();
        }
      } catch {
        showLocationAlert();
      }
    } else {
      // No location data available
      showLocationAlert();
    }
  };

  // Check if the call carries a routable destination POI (coordinates or address)
  const hasDestinationData = (call: typeof activeCall) => {
    if (!call) return false;
    // (0,0) is the server's no-data sentinel, not a real destination
    const hasCoordinates = call.DestinationLatitude != null && call.DestinationLongitude != null && (call.DestinationLatitude !== 0 || call.DestinationLongitude !== 0);
    const hasAddress = !!call.DestinationAddress && call.DestinationAddress.trim() !== '';
    return hasCoordinates || hasAddress;
  };

  const handleDestinationDirections = async () => {
    if (!activeCall) return;

    const latitude = activeCall.DestinationLatitude;
    const longitude = activeCall.DestinationLongitude;
    const address = activeCall.DestinationAddress;
    const name = activeCall.DestinationName || activeCall.DestinationAddress;

    // Prefer the destination POI coordinates; fall back to its address.
    // (0,0) is the server's no-data sentinel, not a real destination.
    if (latitude != null && longitude != null && (latitude !== 0 || longitude !== 0)) {
      try {
        const opened = await openMapsWithDirections(latitude, longitude, name);
        if (!opened) {
          showLocationAlert();
        }
      } catch {
        showLocationAlert();
      }
    } else if (address && address.trim() !== '') {
      try {
        const opened = await openMapsWithAddress(address);
        if (!opened) {
          showLocationAlert();
        }
      } catch {
        showLocationAlert();
      }
    } else {
      showLocationAlert();
    }
  };

  return (
    <>
      <Pressable onPress={() => setIsBottomSheetOpen(true)} className="w-full" testID="call-selection-trigger">
        {activeCall && activePriority ? (
          <CallCard call={activeCall} priority={activePriority} />
        ) : (
          <Card className="w-full bg-background-50">
            <Text className="font-medium">{t('calls.no_call_selected')}</Text>
            <Text className="text-sm text-gray-500">{t('calls.no_call_selected_info')}</Text>
          </Card>
        )}
      </Pressable>

      {activeCall ? (
        <HStack className="w-full">
          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            action="primary"
            accessibilityLabel={t('map.view_call_details')}
            onPress={() => {
              router.push(`/call/${activeCall.CallId}`);
            }}
          >
            <ButtonIcon as={Eye} />
          </Button>

          {hasLocationData(activeCall) ? (
            <Button variant="outline" className="flex-1" size="sm" action="primary" onPress={handleDirections} accessibilityLabel={t('calls.directions')}>
              <ButtonIcon as={MapPin} />
            </Button>
          ) : null}

          {hasDestinationData(activeCall) ? (
            <Button
              variant="outline"
              className="flex-1"
              size="sm"
              action="primary"
              onPress={handleDestinationDirections}
              testID="call-destination-directions-button"
              accessibilityLabel={t('calls.directions_to_destination')}
            >
              <ButtonIcon as={Navigation} />
            </Button>
          ) : null}

          <Button variant="outline" className="flex-1" size="sm" action="primary" onPress={handleDeselect} accessibilityLabel={t('calls.deselect')}>
            <ButtonIcon as={CircleX} />
          </Button>
        </HStack>
      ) : null}

      <CustomBottomSheet isOpen={isBottomSheetOpen} onClose={() => setIsBottomSheetOpen(false)} isLoading={isLoading} loadingText={t('common.loading')} snapPoints={[60]} testID="call-selection-bottom-sheet">
        <VStack space="md" className="w-full flex-1">
          <Text className="text-lg font-bold">{t('calls.select_active_call')}</Text>
          {isError ? (
            <VStack space="sm" className="w-full items-center py-8">
              <Text className="text-center text-red-600 dark:text-red-400">{t('calls.errors.load_failed')}</Text>
              <Button variant="outline" size="sm" action="primary" onPress={handleRetry} testID="call-selection-retry-button">
                <ButtonText>{t('common.retry')}</ButtonText>
              </Button>
            </VStack>
          ) : (
            <ScrollView className="w-full flex-1" showsVerticalScrollIndicator={false}>
              <VStack space="md" className="w-full">
                {openCallsData?.map((call) => (
                  <Pressable
                    key={call.CallId}
                    onPress={() => {
                      const handleCallSelect = async () => {
                        try {
                          await setActiveCall(call.CallId);
                          setIsBottomSheetOpen(false);
                        } catch (error) {
                          logger.error({ message: 'Failed to set active call', context: { error, callId: call.CallId } });
                        }
                      };
                      handleCallSelect().catch((error) => {
                        logger.error({ message: 'Failed to handle call selection', context: { error, callId: call.CallId } });
                      });
                    }}
                    className={`rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'} ${
                      activeCall?.CallId === call.CallId ? (colorScheme === 'dark' ? 'bg-primary-900' : 'bg-primary-50') : ''
                    }`}
                    testID={`call-item-${call.CallId}`}
                  >
                    <HStack space="md" className="items-center justify-between">
                      <VStack className="flex-1">
                        <Text className={`font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{call.Name}</Text>
                        <Text size="sm" className={colorScheme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}>
                          {call.Type}
                        </Text>
                      </VStack>
                      {activeCall?.CallId === call.CallId ? <Check size={20} color={colorScheme === 'dark' ? '#60a5fa' : '#2563eb'} /> : null}
                    </HStack>
                  </Pressable>
                ))}
                {!isLoading && openCallsData?.length === 0 ? (
                  <Text className="py-8 text-center text-gray-500" testID="no-calls-message">
                    {t('calls.no_open_calls')}
                  </Text>
                ) : null}
              </VStack>
            </ScrollView>
          )}
        </VStack>
      </CustomBottomSheet>
    </>
  );
};
