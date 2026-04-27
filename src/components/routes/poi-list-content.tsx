import { router } from 'expo-router';
import { ChevronDownIcon, RefreshCcwDotIcon, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { filterPois, getPoiDisplayName, getPoiTypeName, isPoiDestinationEnabled, sortPois, type PoiSortOption } from '@/lib/poi-utils';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { PoiCard } from '@/components/routes/poi-card';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { usePoisStore } from '@/stores/pois/store';

export const PoiListContent: React.FC = () => {
  const { t } = useTranslation();
  const poiTypes = usePoisStore((state) => state.poiTypes);
  const pois = usePoisStore((state) => state.pois);
  const isLoading = usePoisStore((state) => state.isLoading);
  const error = usePoisStore((state) => state.error);
  const fetchAllPoiData = usePoisStore((state) => state.fetchAllPoiData);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoiTypeId, setSelectedPoiTypeId] = useState('all');
  const [sortBy, setSortBy] = useState<PoiSortOption>('display');

  useEffect(() => {
    fetchAllPoiData();
  }, [fetchAllPoiData]);

  const poiTypesById = useMemo(() => {
    return poiTypes.reduce<Record<number, (typeof poiTypes)[number]>>((accumulator, poiType) => {
      accumulator[poiType.PoiTypeId] = poiType;
      return accumulator;
    }, {});
  }, [poiTypes]);

  const visiblePois = useMemo(() => {
    const filteredPois = filterPois(pois, {
      poiTypesById,
      searchQuery,
      poiTypeId: selectedPoiTypeId === 'all' ? null : Number(selectedPoiTypeId),
    });
    return sortPois(filteredPois, poiTypesById, sortBy);
  }, [poiTypesById, pois, searchQuery, selectedPoiTypeId, sortBy]);

  const handleRefresh = () => {
    fetchAllPoiData(true);
  };

  if (isLoading && pois.length === 0) {
    return <Loading text={t('routes.loading_pois')} />;
  }

  if (error && pois.length === 0) {
    return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
  }

  return (
    <Box className="flex-1">
      <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
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

      <HStack className="mb-4 gap-3">
        <Select selectedValue={selectedPoiTypeId} onValueChange={setSelectedPoiTypeId}>
          <SelectTrigger className="flex-1 bg-white dark:bg-gray-800">
            <SelectInput placeholder={t('routes.poi_filter_placeholder')} />
            <SelectIcon as={ChevronDownIcon} className="mr-2" />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectItem label={t('routes.poi_filter_all_types')} value="all" />
              {poiTypes.map((poiType) => (
                <SelectItem key={poiType.PoiTypeId} label={poiType.Name} value={String(poiType.PoiTypeId)} />
              ))}
            </SelectContent>
          </SelectPortal>
        </Select>

        <Select selectedValue={sortBy} onValueChange={(value) => setSortBy(value as PoiSortOption)}>
          <SelectTrigger className="flex-1 bg-white dark:bg-gray-800">
            <SelectInput placeholder={t('routes.poi_sort_placeholder')} />
            <SelectIcon as={ChevronDownIcon} className="mr-2" />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectItem label={t('routes.poi_sort_display')} value="display" />
              <SelectItem label={t('routes.poi_sort_type')} value="type" />
            </SelectContent>
          </SelectPortal>
        </Select>
      </HStack>

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
            onPress={() => router.push(`/routes/poi/${item.PoiId}` as any)}
          />
        )}
        ListEmptyComponent={
          <ZeroState
            heading={t('routes.no_pois')}
            description={searchQuery || selectedPoiTypeId !== 'all' ? t('routes.no_pois_filtered_description') : t('routes.no_pois_description')}
            icon={RefreshCcwDotIcon}
          />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </Box>
  );
};
