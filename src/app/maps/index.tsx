import { router, useFocusEffect } from 'expo-router';
import { Building2, Layers, Map, Search, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type CustomMapResultData, CustomMapType } from '@/models/v4/mapping/customMapResultData';
import { type IndoorMapResultData } from '@/models/v4/mapping/indoorMapResultData';
import { type ActiveLayerSummary } from '@/models/v4/mapping/mappingResults';
import { useMapsStore } from '@/stores/maps/store';

export default function MapsHome() {
  const { t } = useTranslation();

  const getCustomMapTypeLabel = (type: number): string => {
    switch (type) {
      case CustomMapType.Outdoor:
        return t('maps.outdoor');
      case CustomMapType.Event:
        return t('maps.event');
      case CustomMapType.General:
        return t('maps.general');
      default:
        return t('common.unknown');
    }
  };
  const indoorMaps = useMapsStore((state) => state.indoorMaps);
  const customMaps = useMapsStore((state) => state.customMaps);
  const activeLayers = useMapsStore((state) => state.activeLayers);
  const layerToggles = useMapsStore((state) => state.layerToggles);
  const isLoading = useMapsStore((state) => state.isLoading);
  const isLoadingLayers = useMapsStore((state) => state.isLoadingLayers);
  const error = useMapsStore((state) => state.error);
  const fetchIndoorMaps = useMapsStore((state) => state.fetchIndoorMaps);
  const fetchCustomMaps = useMapsStore((state) => state.fetchCustomMaps);
  const fetchActiveLayers = useMapsStore((state) => state.fetchActiveLayers);
  const toggleLayer = useMapsStore((state) => state.toggleLayer);

  const [showLayers, setShowLayers] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchIndoorMaps();
      fetchCustomMaps();
      fetchActiveLayers();
    }, [fetchIndoorMaps, fetchCustomMaps, fetchActiveLayers])
  );

  const handleRefresh = () => {
    fetchIndoorMaps();
    fetchCustomMaps();
    fetchActiveLayers();
  };

  const renderCustomMapCard = (map: CustomMapResultData) => (
    <Pressable key={map.CustomMapId} onPress={() => router.push(`/maps/custom/${map.CustomMapId}`)}>
      <Card className="mb-3 rounded-xl bg-white p-4 dark:bg-gray-800">
        <HStack className="items-center" space="md">
          <Box className="items-center justify-center rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
            <Icon as={Map} size="md" className="text-blue-600 dark:text-blue-300" />
          </Box>
          <VStack className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{map.Name}</Text>
            {map.Description ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
                {map.Description}
              </Text>
            ) : null}
          </VStack>
          <Badge action="info" variant="outline" size="sm">
            <BadgeText>{getCustomMapTypeLabel(map.Type)}</BadgeText>
          </Badge>
        </HStack>
      </Card>
    </Pressable>
  );

  const renderIndoorMapCard = (map: IndoorMapResultData) => (
    <Pressable key={map.IndoorMapId} onPress={() => router.push(`/maps/indoor/${map.IndoorMapId}`)}>
      <Card className="mb-3 rounded-xl bg-white p-4 dark:bg-gray-800">
        <HStack className="items-center" space="md">
          <Box className="items-center justify-center rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
            <Icon as={Building2} size="md" className="text-purple-600 dark:text-purple-300" />
          </Box>
          <VStack className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{map.Name}</Text>
            {map.Description ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
                {map.Description}
              </Text>
            ) : null}
            <Text className="text-xs text-gray-400 dark:text-gray-500">{t('maps.floor_count', { count: map.Floors?.length ?? 0 })}</Text>
          </VStack>
          <Badge action="muted" variant="outline" size="sm">
            <BadgeText>{t('maps.indoor')}</BadgeText>
          </Badge>
        </HStack>
      </Card>
    </Pressable>
  );

  const renderLayerToggle = (layer: ActiveLayerSummary) => (
    <HStack key={layer.LayerId} className="items-center justify-between py-2">
      <HStack className="flex-1 items-center" space="sm">
        <Box className="size-3 rounded-full" style={{ backgroundColor: layer.Color || '#6B7280' }} />
        <Text className="text-sm text-gray-700 dark:text-gray-300">{layer.Name}</Text>
      </HStack>
      <Switch size="sm" value={layerToggles[layer.LayerId] ?? false} onToggle={() => toggleLayer(layer.LayerId)} />
    </HStack>
  );

  const sections = [
    ...(customMaps.length > 0
      ? [
          {
            title: t('maps.custom_maps'),
            data: customMaps,
            renderItem: ({ item }: { item: CustomMapResultData }) => renderCustomMapCard(item),
          },
        ]
      : []),
    ...(indoorMaps.length > 0
      ? [
          {
            title: t('maps.indoor_maps'),
            data: indoorMaps,
            renderItem: ({ item }: { item: IndoorMapResultData }) => renderIndoorMapCard(item),
          },
        ]
      : []),
  ];

  const renderContent = () => {
    if (isLoading) {
      return <Loading text={t('maps.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.error')} description={error} isError />;
    }

    if (customMaps.length === 0 && indoorMaps.length === 0) {
      return <ZeroState heading={t('maps.no_maps')} description={t('maps.no_maps_description')} icon={Map} />;
    }

    return (
      <SectionList
        sections={sections as any}
        keyExtractor={(item: CustomMapResultData | IndoorMapResultData) => ('CustomMapId' in item ? item.CustomMapId : item.IndoorMapId)}
        renderSectionHeader={({ section }) => <Text className="mb-2 mt-4 text-lg font-bold text-gray-900 dark:text-white">{section.title}</Text>}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        {/* Search bar */}
        <Pressable onPress={() => router.push('/maps/search')}>
          <Input className="mb-3 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline" isReadOnly>
            <InputSlot className="pl-3">
              <InputIcon as={Search} />
            </InputSlot>
            <InputField placeholder={t('maps.search_placeholder')} editable={false} />
          </Input>
        </Pressable>

        {/* Layer toggles */}
        {activeLayers.length > 0 ? (
          <Pressable onPress={() => setShowLayers(!showLayers)}>
            <HStack className="mb-3 items-center justify-between rounded-lg bg-white px-4 py-3 dark:bg-gray-800">
              <HStack className="items-center" space="sm">
                <Icon as={Layers} size="sm" className="text-gray-600 dark:text-gray-400" />
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('maps.active_layers')}</Text>
              </HStack>
              <Text className="text-xs text-gray-500">{t('maps.layers_on', { active: Object.values(layerToggles).filter(Boolean).length, total: activeLayers.length })}</Text>
            </HStack>
          </Pressable>
        ) : null}

        {showLayers && activeLayers.length > 0 ? (
          <Card className="mb-3 rounded-xl bg-white px-4 py-2 dark:bg-gray-800">{isLoadingLayers ? <Loading text={t('common.loading')} /> : activeLayers.map(renderLayerToggle)}</Card>
        ) : null}

        {/* Main content */}
        <Box className="flex-1">{renderContent()}</Box>
      </Box>
    </View>
  );
}
