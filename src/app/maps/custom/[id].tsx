import { useLocalSearchParams } from 'expo-router';
import { ChevronDown, Eye, EyeOff, Layers, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { getCustomMapLayerImageUrl, getCustomMapTileUrl } from '@/api/mapping/mapping';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import Mapbox from '@/components/maps/mapbox';
import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type CustomMapLayerResultData } from '@/models/v4/mapping/customMapResultData';
import { useMapsStore } from '@/stores/maps/store';

export default function CustomMapViewer() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentCustomMap = useMapsStore((state) => state.currentCustomMap);
  const isLoading = useMapsStore((state) => state.isLoading);
  const error = useMapsStore((state) => state.error);
  const fetchCustomMap = useMapsStore((state) => state.fetchCustomMap);
  const clearCurrentMap = useMapsStore((state) => state.clearCurrentMap);

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (id) {
      fetchCustomMap(id);
    }
    return () => {
      clearCurrentMap();
    };
  }, [id, fetchCustomMap, clearCurrentMap]);

  // Initialize layer visibility from defaults
  useEffect(() => {
    if (currentCustomMap?.Layers) {
      const visibility: Record<string, boolean> = {};
      currentCustomMap.Layers.forEach((layer) => {
        visibility[layer.CustomMapLayerId] = layer.IsOnByDefault;
      });
      setLayerVisibility(visibility);
    }
  }, [currentCustomMap]);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  const handleFeaturePress = useCallback((event: { features?: { properties?: Record<string, unknown> }[] }) => {
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      setSelectedFeature(feature.properties ?? null);
    }
  }, []);

  const visibleLayers = useMemo(() => {
    if (!currentCustomMap?.Layers) return [];
    return currentCustomMap.Layers.filter((layer) => layerVisibility[layer.CustomMapLayerId]);
  }, [currentCustomMap, layerVisibility]);

  const renderVectorLayer = (layer: CustomMapLayerResultData) => {
    if (!layer.GeoJson) return null;

    let geoJSON;
    try {
      geoJSON = typeof layer.GeoJson === 'string' ? JSON.parse(layer.GeoJson) : layer.GeoJson;
    } catch {
      return null;
    }

    return (
      <Mapbox.ShapeSource key={`shape-${layer.CustomMapLayerId}`} id={`shape-${layer.CustomMapLayerId}`} shape={geoJSON} onPress={handleFeaturePress as any}>
        <Mapbox.FillLayer
          id={`fill-${layer.CustomMapLayerId}`}
          style={{
            fillColor: layer.Color || '#3B82F6',
            fillOpacity: layer.Opacity * 0.3,
          }}
        />
        <Mapbox.LineLayer
          id={`line-${layer.CustomMapLayerId}`}
          style={{
            lineColor: layer.Color || '#3B82F6',
            lineWidth: 2,
            lineOpacity: layer.Opacity,
          }}
        />
        <Mapbox.SymbolLayer
          id={`symbol-${layer.CustomMapLayerId}`}
          style={{
            textField: ['get', 'name'],
            textSize: 12,
            textColor: '#1F2937',
            textHaloColor: '#FFFFFF',
            textHaloWidth: 1,
          }}
        />
      </Mapbox.ShapeSource>
    );
  };

  const renderImageLayer = (layer: CustomMapLayerResultData) => {
    if (!layer.HasImage) return null;

    const imageUrl = getCustomMapLayerImageUrl(layer.CustomMapLayerId);

    return (
      <Mapbox.ImageSource
        key={`img-${layer.CustomMapLayerId}`}
        id={`img-${layer.CustomMapLayerId}`}
        url={imageUrl}
        coordinates={[
          [layer.BoundsSWLongitude, layer.BoundsNELatitude], // NW (top-left)
          [layer.BoundsNELongitude, layer.BoundsNELatitude], // NE (top-right)
          [layer.BoundsNELongitude, layer.BoundsSWLatitude], // SE (bottom-right)
          [layer.BoundsSWLongitude, layer.BoundsSWLatitude], // SW (bottom-left)
        ]}
      >
        <Mapbox.RasterLayer id={`raster-img-${layer.CustomMapLayerId}`} style={{ rasterOpacity: layer.Opacity }} />
      </Mapbox.ImageSource>
    );
  };

  const renderTiledLayer = (layer: CustomMapLayerResultData) => {
    if (!layer.HasTiles) return null;

    const tileUrl = getCustomMapTileUrl(layer.CustomMapLayerId);

    return (
      <Mapbox.RasterSource key={`tile-${layer.CustomMapLayerId}`} id={`tile-${layer.CustomMapLayerId}`} tileUrlTemplates={[tileUrl]} tileSize={256}>
        <Mapbox.RasterLayer id={`raster-tile-${layer.CustomMapLayerId}`} style={{ rasterOpacity: layer.Opacity }} />
      </Mapbox.RasterSource>
    );
  };

  const renderLayer = (layer: CustomMapLayerResultData) => {
    if (layer.HasTiles) {
      return renderTiledLayer(layer);
    }
    if (layer.HasImage) {
      return renderImageLayer(layer);
    }
    return renderVectorLayer(layer);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading text={t('maps.loading')} />
      </View>
    );
  }

  if (error || !currentCustomMap) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <ZeroState heading={t('maps.error_loading')} description={error || t('maps.error_loading')} isError />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Map */}
      <View className="flex-1">
        <Mapbox.MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Street} logoEnabled={false} attributionEnabled={false}>
          <Mapbox.Camera zoomLevel={currentCustomMap.ZoomLevel || 14} centerCoordinate={[currentCustomMap.CenterLongitude, currentCustomMap.CenterLatitude]} animationMode="flyTo" animationDuration={1000} />

          {visibleLayers.map(renderLayer)}
        </Mapbox.MapView>

        {/* Feature detail popover */}
        {selectedFeature ? (
          <Box className="absolute bottom-24 left-4 right-4">
            <Card className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-800">
              <HStack className="items-start justify-between">
                <VStack className="flex-1" space="xs">
                  <Text className="text-base font-bold text-gray-900 dark:text-white">{(selectedFeature.name as string) || (selectedFeature.Name as string) || 'Region'}</Text>
                  {selectedFeature.description || selectedFeature.Description ? (
                    <Text className="text-sm text-gray-600 dark:text-gray-400">{(selectedFeature.description as string) || (selectedFeature.Description as string)}</Text>
                  ) : null}
                  {selectedFeature.type || selectedFeature.Type ? <Text className="text-xs text-gray-500">Type: {(selectedFeature.type as string) || (selectedFeature.Type as string)}</Text> : null}
                </VStack>
                <Pressable onPress={() => setSelectedFeature(null)} className="p-1">
                  <Icon as={X} size="sm" className="text-gray-400" />
                </Pressable>
              </HStack>
            </Card>
          </Box>
        ) : null}

        {/* Layer toggle button */}
        <Pressable onPress={() => setShowLayerSheet(!showLayerSheet)} className="absolute right-4 top-4 rounded-full bg-white p-3 shadow-md dark:bg-gray-800">
          <Icon as={Layers} size="md" className="text-gray-700 dark:text-gray-300" />
        </Pressable>
      </View>

      {/* Bottom sheet for layer toggles */}
      {showLayerSheet ? (
        <Box className="absolute bottom-0 left-0 right-0 max-h-[50%] rounded-t-3xl bg-white shadow-lg dark:bg-gray-800">
          <VStack className="p-4">
            <HStack className="mb-4 items-center justify-between">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">{t('maps.layer_toggles')}</Text>
              <Pressable onPress={() => setShowLayerSheet(false)} className="p-1">
                <Icon as={ChevronDown} size="md" className="text-gray-400" />
              </Pressable>
            </HStack>
            <ScrollView>
              {currentCustomMap.Layers.map((layer) => (
                <Pressable key={layer.CustomMapLayerId} onPress={() => toggleLayerVisibility(layer.CustomMapLayerId)}>
                  <HStack className="items-center justify-between border-b border-gray-100 py-3 dark:border-gray-700">
                    <HStack className="flex-1 items-center" space="sm">
                      <Box className="size-4 rounded" style={{ backgroundColor: layer.Color || '#3B82F6' }} />
                      <VStack>
                        <Text className="text-sm font-medium text-gray-900 dark:text-white">{layer.Name}</Text>
                      </VStack>
                    </HStack>
                    <Icon as={layerVisibility[layer.CustomMapLayerId] ? Eye : EyeOff} size="sm" className={layerVisibility[layer.CustomMapLayerId] ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} />
                  </HStack>
                </Pressable>
              ))}
            </ScrollView>
          </VStack>
        </Box>
      ) : null}
    </View>
  );
}
