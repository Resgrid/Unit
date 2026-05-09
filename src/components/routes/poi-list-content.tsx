import { router } from 'expo-router';
import { MapPin, RefreshCcwDotIcon, Search, SlidersHorizontal, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, RefreshControl, ScrollView } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { PoiCard } from '@/components/routes/poi-card';
import { useFilterContext } from '@/components/routes/filter-context';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { filterPois, getPoiDisplayName, getPoiTypeName, isPoiDestinationEnabled, sortPois } from '@/lib/poi-utils';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { usePoisStore } from '@/stores/pois/store';

export const PoiListContent: React.FC = () => {
  const { t } = useTranslation();
  const poiTypes = usePoisStore((state) => state.poiTypes);
  const pois = usePoisStore((state) => state.pois);
  const destinationPois = usePoisStore((state) => state.destinationPois);
  const isLoading = usePoisStore((state) => state.isLoading);
  const error = usePoisStore((state) => state.error);
  const fetchAllPoiData = usePoisStore((state) => state.fetchAllPoiData);
  const [searchQuery, setSearchQuery] = useState('');

  const { selectedPoiTypeId, sortBy, activeFilterCount, openFilter, clearFilters } = useFilterContext();

  useEffect(() => {
    fetchAllPoiData();
  }, [fetchAllPoiData]);

  // Combine both pois and destinationPois into a single list for display
  const allPois = useMemo(() => {
    const seen = new Set<number>();
    const combined: PoiResultData[] = [];
    for (const poi of [...pois, ...destinationPois]) {
      if (!seen.has(poi.PoiId)) {
        seen.add(poi.PoiId);
        combined.push(poi);
      }
    }
    return combined;
  }, [pois, destinationPois]);

  const poiTypesById = useMemo(() => {
    return poiTypes.reduce<Record<number, (typeof poiTypes)[number]>>((accumulator, poiType) => {
      accumulator[poiType.PoiTypeId] = poiType;
      return accumulator;
    }, {});
  }, [poiTypes]);

  const visiblePois = useMemo(() => {
    const filteredPois = filterPois(allPois, {
      poiTypesById,
      searchQuery,
      poiTypeId: selectedPoiTypeId,
    });
    return sortPois(filteredPois, poiTypesById, sortBy);
  }, [poiTypesById, allPois, searchQuery, selectedPoiTypeId, sortBy]);

  const hasActiveFilters = selectedPoiTypeId !== null || sortBy !== 'display';

  const handleRefresh = useCallback(() => {
    fetchAllPoiData(true);
  }, [fetchAllPoiData]);

  const handleClearFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  if (isLoading && allPois.length === 0) {
    return <Loading text={t('routes.loading_pois')} />;
  }

  if (error && allPois.length === 0) {
    return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
  }

  const isFiltered = searchQuery || selectedPoiTypeId !== null;

  return (
    <Box className="flex-1">
      <HStack className="mb-3 items-center gap-2 top-2">
        <Input className="flex-1 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('routes.search_pois')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        <Pressable
          onPress={openFilter}
          className={`relative size-11 items-center justify-center rounded-lg ${hasActiveFilters ? 'bg-primary-500' : 'bg-white dark:bg-gray-800'} border border-gray-200 dark:border-gray-700`}
          testID="poi-filter-button"
        >
          <SlidersHorizontal size={20} color={hasActiveFilters ? '#ffffff' : '#6b7280'} />
          {activeFilterCount > 0 ? (
            <Box className="absolute -right-1.5 -top-1.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1" style={{ minHeight: 18 }}>
              <Text className="text-2xs font-bold text-white" numberOfLines={1}>
                {activeFilterCount}
              </Text>
            </Box>
          ) : null}
        </Pressable>
      </HStack>

      {visiblePois.length > 0 ? (
        <FlatList<PoiResultData>
          testID="pois-list"
          data={visiblePois}
          keyExtractor={(item) => String(item.PoiId)}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <PoiCard
              poi={item}
              poiTypeLabel={getPoiTypeName(item, poiTypesById) || t('routes.poi_type_unknown')}
              displayName={getPoiDisplayName(item, poiTypesById)}
              isDestinationEnabled={isPoiDestinationEnabled(item, poiTypesById)}
              onPress={() => router.push({ pathname: '/routes/poi/[id]', params: { id: item.PoiId } })}
            />
          )}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 120 : 100 }}
        />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
          contentContainerClassName="flex-1"
          showsVerticalScrollIndicator={false}
        >
          {isFiltered ? (
            <Box className="flex-1 items-center justify-center px-8 py-12">
              <VStack space="md" className="items-center">
                <Box className="items-center justify-center">
                  <Box className="absolute size-28 rounded-full bg-orange-50 dark:bg-orange-900/20" />
                  <Box className="absolute size-16 rounded-full bg-orange-100 dark:bg-orange-900/30" />
                  <Box className="size-12 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/30">
                    <Search size={24} color="#ffffff" />
                  </Box>
                </Box>
                <Text className="text-center text-xl font-bold text-gray-900 dark:text-white">{t('routes.no_search_results_pois')}</Text>
                <Text className="max-w-[280] text-center text-base leading-5 text-gray-500 dark:text-gray-400">{t('routes.no_pois_filtered_description')}</Text>
                <Pressable onPress={handleClearFilters} className="mt-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800">
                  <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">{t('routes.clear_filters')}</Text>
                </Pressable>
              </VStack>
            </Box>
          ) : (
            <Box className="flex-1 items-center justify-center px-8 py-12">
              <VStack space="md" className="items-center">
                <Box className="items-center justify-center">
                  <Box className="absolute size-28 rounded-full bg-indigo-50 dark:bg-indigo-900/20" />
                  <Box className="absolute size-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
                  <Box className="size-12 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30">
                    <MapPin size={24} color="#ffffff" />
                  </Box>
                </Box>
                <Text className="text-center text-xl font-bold text-gray-900 dark:text-white">{t('routes.no_pois')}</Text>
                <Text className="max-w-[280] text-center text-base leading-5 text-gray-500 dark:text-gray-400">{t('routes.no_pois_description')}</Text>
                <HStack className="mt-2 items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800">
                  <RefreshCcwDotIcon size={14} color="#6366f1" />
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{t('routes.pull_to_refresh')}</Text>
                </HStack>
              </VStack>
            </Box>
          )}
        </ScrollView>
      )}
    </Box>
  );
};
