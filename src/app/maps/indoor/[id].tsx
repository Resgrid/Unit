import { router, useLocalSearchParams } from 'expo-router';
import { Building2, Search, Send, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { getFloorImageUrl } from '@/api/mapping/mapping';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import Mapbox from '@/components/maps/mapbox';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type IndoorMapFloorResultData } from '@/models/v4/mapping/indoorMapResultData';
import { useMapsStore } from '@/stores/maps/store';

export default function IndoorMapViewer() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentIndoorMap = useMapsStore((state) => state.currentIndoorMap);
  const currentFloor = useMapsStore((state) => state.currentFloor);
  const currentFloorId = useMapsStore((state) => state.currentFloorId);
  const currentZonesGeoJSON = useMapsStore((state) => state.currentZonesGeoJSON);
  const isLoading = useMapsStore((state) => state.isLoading);
  const isLoadingGeoJSON = useMapsStore((state) => state.isLoadingGeoJSON);
  const error = useMapsStore((state) => state.error);
  const fetchIndoorMap = useMapsStore((state) => state.fetchIndoorMap);
  const setCurrentFloor = useMapsStore((state) => state.setCurrentFloor);
  const clearCurrentMap = useMapsStore((state) => state.clearCurrentMap);

  const [zoneSearchQuery, setZoneSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (id) {
      fetchIndoorMap(id);
    }
    return () => {
      clearCurrentMap();
    };
  }, [id, fetchIndoorMap, clearCurrentMap]);

  const sortedFloors = useMemo(() => {
    if (!currentIndoorMap?.Floors) return [];
    return [...currentIndoorMap.Floors].sort((a, b) => a.FloorOrder - b.FloorOrder);
  }, [currentIndoorMap]);

  const handleFloorSelect = useCallback(
    (floorId: string) => {
      setSelectedZone(null);
      setCurrentFloor(floorId);
    },
    [setCurrentFloor]
  );

  const handleZonePress = useCallback((event: any) => {
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      setSelectedZone(feature.properties ?? null);
    }
  }, []);

  const handleDispatchToZone = useCallback(() => {
    if (selectedZone) {
      router.push({
        pathname: '/call/new' as any,
        params: {
          zoneName: (selectedZone.name as string) || (selectedZone.Name as string) || '',
          zoneId: (selectedZone.id as string) || (selectedZone.Id as string) || '',
        },
      });
    }
  }, [selectedZone]);

  const floorImageUrl = useMemo(() => {
    if (!currentFloorId) return null;
    return getFloorImageUrl(currentFloorId);
  }, [currentFloorId]);

  const filteredZonesGeoJSON = useMemo(() => {
    if (!currentZonesGeoJSON || !zoneSearchQuery.trim()) return currentZonesGeoJSON;

    const query = zoneSearchQuery.toLowerCase();
    return {
      ...currentZonesGeoJSON,
      features: currentZonesGeoJSON.features.filter((feature) => {
        const name = ((feature.properties?.name as string) || (feature.properties?.Name as string) || '').toLowerCase();
        return name.includes(query);
      }),
    };
  }, [currentZonesGeoJSON, zoneSearchQuery]);

  if (isLoading && !currentIndoorMap) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading text={t('maps.loading')} />
      </View>
    );
  }

  if (error || !currentIndoorMap) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <ZeroState heading={t('maps.error_loading')} description={error || t('maps.error_loading')} isError />
      </View>
    );
  }

  const isZoneDispatchable = selectedZone && (selectedZone.IsDispatchable === true || selectedZone.isDispatchable === true);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Floor selector tab bar */}
      <Box className="bg-white dark:bg-gray-800">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-2 py-2">
          <HStack space="sm">
            {sortedFloors.map((floor: IndoorMapFloorResultData) => {
              const isActive = floor.IndoorMapFloorId === currentFloorId;
              return (
                <Pressable
                  key={floor.IndoorMapFloorId}
                  onPress={() => handleFloorSelect(floor.IndoorMapFloorId)}
                  className={`rounded-full px-4 py-2 ${isActive ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  <Text className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{floor.Name}</Text>
                </Pressable>
              );
            })}
          </HStack>
        </ScrollView>
      </Box>

      {/* Zone search bar */}
      <Box className="bg-white px-4 pb-2 dark:bg-gray-800">
        <Input className="rounded-lg bg-gray-50 dark:bg-gray-700" size="sm" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('maps.search_placeholder')} value={zoneSearchQuery} onChangeText={setZoneSearchQuery} />
          {zoneSearchQuery ? (
            <InputSlot className="pr-3" onPress={() => setZoneSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>
      </Box>

      {/* Map */}
      <View className="flex-1">
        {isLoadingGeoJSON ? (
          <View className="flex-1 items-center justify-center">
            <Loading text={t('common.loading')} />
          </View>
        ) : (
          <Mapbox.MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Street} logoEnabled={false} attributionEnabled={false}>
            <Mapbox.Camera zoomLevel={currentIndoorMap.BoundsNELatitude ? 18 : 16} centerCoordinate={[currentIndoorMap.CenterLongitude, currentIndoorMap.CenterLatitude]} animationMode="flyTo" animationDuration={800} />

            {/* Floor plan image overlay */}
            {floorImageUrl && currentFloor && currentIndoorMap.BoundsNELatitude ? (
              <Mapbox.ImageSource
                id="floor-image"
                url={floorImageUrl}
                coordinates={[
                  [currentIndoorMap.BoundsSWLongitude, currentIndoorMap.BoundsNELatitude], // NW (top-left)
                  [currentIndoorMap.BoundsNELongitude, currentIndoorMap.BoundsNELatitude], // NE (top-right)
                  [currentIndoorMap.BoundsNELongitude, currentIndoorMap.BoundsSWLatitude], // SE (bottom-right)
                  [currentIndoorMap.BoundsSWLongitude, currentIndoorMap.BoundsSWLatitude], // SW (bottom-left)
                ]}
              >
                <Mapbox.RasterLayer id="floor-raster" style={{ rasterOpacity: currentFloor.Opacity }} />
              </Mapbox.ImageSource>
            ) : null}

            {/* Zone polygons */}
            {filteredZonesGeoJSON ? (
              <Mapbox.ShapeSource id="zones-source" shape={filteredZonesGeoJSON} onPress={handleZonePress}>
                <Mapbox.FillLayer
                  id="zones-fill"
                  style={{
                    fillColor: ['get', 'color'],
                    fillOpacity: 0.3,
                  }}
                />
                <Mapbox.LineLayer
                  id="zones-line"
                  style={{
                    lineColor: ['get', 'color'],
                    lineWidth: 2,
                    lineOpacity: 0.8,
                  }}
                />
                <Mapbox.SymbolLayer
                  id="zones-label"
                  style={{
                    textField: ['coalesce', ['get', 'name'], ['get', 'Name']],
                    textSize: 11,
                    textColor: '#1F2937',
                    textHaloColor: '#FFFFFF',
                    textHaloWidth: 1,
                    textAllowOverlap: false,
                  }}
                />
              </Mapbox.ShapeSource>
            ) : null}
          </Mapbox.MapView>
        )}

        {/* Zone detail popover */}
        {selectedZone ? (
          <Box className="absolute bottom-4 left-4 right-4">
            <Card className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-800">
              <HStack className="items-start justify-between">
                <VStack className="flex-1" space="xs">
                  <HStack className="items-center" space="sm">
                    <Icon as={Building2} size="sm" className="text-purple-600 dark:text-purple-400" />
                    <Text className="text-base font-bold text-gray-900 dark:text-white">{(selectedZone.name as string) || (selectedZone.Name as string) || t('maps.zone')}</Text>
                  </HStack>
                  {selectedZone.type || selectedZone.Type ? (
                    <Badge action="info" variant="outline" size="sm" className="self-start">
                      <BadgeText>{(selectedZone.type as string) || (selectedZone.Type as string)}</BadgeText>
                    </Badge>
                  ) : null}
                  {selectedZone.description || selectedZone.Description ? (
                    <Text className="text-sm text-gray-600 dark:text-gray-400">{(selectedZone.description as string) || (selectedZone.Description as string)}</Text>
                  ) : null}
                  {isZoneDispatchable ? (
                    <Button size="sm" action="primary" className="mt-2 self-start" onPress={handleDispatchToZone}>
                      <ButtonIcon as={Send} className="mr-1" />
                      <ButtonText>{t('maps.dispatch_to_zone')}</ButtonText>
                    </Button>
                  ) : null}
                </VStack>
                <Pressable onPress={() => setSelectedZone(null)} className="p-1">
                  <Icon as={X} size="sm" className="text-gray-400" />
                </Pressable>
              </HStack>
            </Card>
          </Box>
        ) : null}
      </View>
    </View>
  );
}
