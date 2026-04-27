import { MapPin, Navigation } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import StaticMap from '@/components/maps/static-map';
import { StatusBottomSheet } from '@/components/status/status-bottom-sheet';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { createPoiTypeMap, getPoiDisplayName, getPoiSelectionLabel, getPoiTypeName, isPoiDestinationEnabled } from '@/lib/poi-utils';
import { openMapsWithDirections } from '@/lib/navigation';
import { useLocationStore } from '@/stores/app/location-store';
import { usePoisStore } from '@/stores/pois/store';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { useToastStore } from '@/stores/toast/store';

export default function PoiDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const poiId = Array.isArray(id) ? id[0] : id;
  const poiTypes = usePoisStore((state) => state.poiTypes);
  const selectedPoi = usePoisStore((state) => state.selectedPoi);
  const isLoadingDetail = usePoisStore((state) => state.isLoadingDetail);
  const error = usePoisStore((state) => state.error);
  const fetchPoi = usePoisStore((state) => state.fetchPoi);
  const fetchPoiTypes = usePoisStore((state) => state.fetchPoiTypes);
  const clearSelectedPoi = usePoisStore((state) => state.clearSelectedPoi);
  const showToast = useToastStore((state) => state.showToast);
  const openStatusBottomSheet = useStatusBottomSheetStore((state) => state.setIsOpen);
  const setSelectedStatusPoi = useStatusBottomSheetStore((state) => state.setSelectedPoi);
  const userLatitude = useLocationStore((state) => state.latitude);
  const userLongitude = useLocationStore((state) => state.longitude);

  useEffect(() => {
    fetchPoiTypes();
    if (poiId) {
      fetchPoi(poiId);
    }

    return () => {
      clearSelectedPoi();
    };
  }, [clearSelectedPoi, fetchPoi, fetchPoiTypes, poiId]);

  const poiTypesById = useMemo(() => createPoiTypeMap(poiTypes), [poiTypes]);
  const poi = selectedPoi && String(selectedPoi.PoiId) === String(poiId) ? selectedPoi : null;

  const handleRoute = async () => {
    if (!poi) {
      return;
    }

    const success = await openMapsWithDirections(poi.Latitude, poi.Longitude, getPoiSelectionLabel(poi, poiTypesById), userLatitude || undefined, userLongitude || undefined);
    if (!success) {
      showToast('error', t('routes.failed_to_open_poi_maps'));
    }
  };

  const handleSetDestination = () => {
    if (!poi || !destinationEnabled) {
      return;
    }

    setSelectedStatusPoi(poi);
    openStatusBottomSheet(true);
  };

  if (isLoadingDetail && !poi) {
    return (
      <View className="size-full flex-1">
        <Loading text={t('routes.loading_poi')} />
      </View>
    );
  }

  if (!poi) {
    return <ZeroState heading={t('routes.poi_not_found')} description={error || t('routes.poi_not_found_description')} icon={MapPin} isError={!!error} />;
  }

  const displayName = getPoiDisplayName(poi, poiTypesById);
  const poiTypeName = getPoiTypeName(poi, poiTypesById) || t('routes.poi_type_unknown');
  const selectionLabel = getPoiSelectionLabel(poi, poiTypesById);
  const destinationEnabled = isPoiDestinationEnabled(poi, poiTypesById);

  return (
    <>
      <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <VStack space="lg" className="p-4">
          <VStack space="sm">
            <Heading size="xl">{displayName}</Heading>
            <HStack className="items-center gap-2">
              <Badge action="muted" variant="outline">
                <BadgeText>{poiTypeName}</BadgeText>
              </Badge>
              {destinationEnabled ? (
                <Badge action="success" variant="solid">
                  <BadgeText>{t('routes.poi_destination_enabled')}</BadgeText>
                </Badge>
              ) : null}
            </HStack>
          </VStack>

          <StaticMap latitude={poi.Latitude} longitude={poi.Longitude} address={selectionLabel} height={240} showUserLocation={true} />

          <VStack space="sm">
            <Button onPress={handleRoute} className="bg-blue-600">
              <ButtonIcon as={Navigation} />
              <ButtonText>{t('routes.route_to_poi')}</ButtonText>
            </Button>
            {destinationEnabled ? (
              <Button onPress={handleSetDestination} variant="outline">
                <ButtonText>{t('routes.set_poi_destination')}</ButtonText>
              </Button>
            ) : null}
          </VStack>

          <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <VStack space="md">
              {poi.Address ? (
                <VStack space="xs">
                  <Text className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t('routes.poi_address')}</Text>
                  <Text className="text-base text-gray-900 dark:text-white">{poi.Address}</Text>
                </VStack>
              ) : null}

              {poi.Note ? (
                <VStack space="xs">
                  <Text className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t('routes.poi_note')}</Text>
                  <Text className="text-base text-gray-900 dark:text-white">{poi.Note}</Text>
                </VStack>
              ) : null}

              <VStack space="xs">
                <Text className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t('routes.poi_coordinates')}</Text>
                <Text className="text-base text-gray-900 dark:text-white">
                  {t('routes.poi_coordinates_value', {
                    latitude: poi.Latitude.toFixed(6),
                    longitude: poi.Longitude.toFixed(6),
                  })}
                </Text>
              </VStack>
            </VStack>
          </Box>
        </VStack>
      </ScrollView>
      <StatusBottomSheet />
    </>
  );
}
