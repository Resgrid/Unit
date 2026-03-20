import { router } from 'expo-router';
import { Building2, Map, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type UnifiedSearchResultItem } from '@/models/v4/mapping/mappingResults';
import { useMapsStore } from '@/stores/maps/store';

type SearchFilter = 'all' | 'indoor' | 'custom';

const SEGMENTS: { labelKey: string; value: SearchFilter }[] = [
  { labelKey: 'maps.all', value: 'all' },
  { labelKey: 'maps.indoor', value: 'indoor' },
  { labelKey: 'maps.custom', value: 'custom' },
];

export default function MapSearch() {
  const { t } = useTranslation();
  const searchResults = useMapsStore((state) => state.searchResults);
  const isLoading = useMapsStore((state) => state.isLoading);
  const searchMapFeatures = useMapsStore((state) => state.searchMapFeatures);
  const clearSearch = useMapsStore((state) => state.clearSearch);

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      clearSearch();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [clearSearch]);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (text.trim().length === 0) {
        clearSearch();
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        searchMapFeatures(text.trim(), activeFilter);
      }, 300);
    },
    [activeFilter, searchMapFeatures, clearSearch]
  );

  const handleFilterChange = useCallback(
    (filter: SearchFilter) => {
      setActiveFilter(filter);
      if (query.trim().length > 0) {
        searchMapFeatures(query.trim(), filter);
      }
    },
    [query, searchMapFeatures]
  );

  const handleResultPress = useCallback((item: UnifiedSearchResultItem) => {
    if (item.Type === 'indoor_zone') {
      router.push(`/maps/indoor/${item.MapId}`);
    } else if (item.Type === 'custom_region') {
      router.push(`/maps/custom/${item.MapId}`);
    }
  }, []);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'indoor_zone':
        return Building2;
      case 'custom_region':
        return Map;
      default:
        return Search;
    }
  };

  const getResultTypeLabel = (type: string) => {
    switch (type) {
      case 'indoor_zone':
        return t('maps.indoor_zone');
      case 'custom_region':
        return t('maps.custom_region');
      default:
        return t('maps.feature');
    }
  };

  const renderResultItem = ({ item }: { item: UnifiedSearchResultItem }) => {
    const ResultIcon = getResultIcon(item.Type);
    const isIndoor = item.Type === 'indoor_zone';

    return (
      <Pressable onPress={() => handleResultPress(item)}>
        <Card className="mb-2 rounded-xl bg-white p-3 dark:bg-gray-800">
          <HStack className="items-center" space="md">
            <Box className={`items-center justify-center rounded-lg p-2 ${isIndoor ? 'bg-purple-100 dark:bg-purple-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
              <Icon as={ResultIcon} size="sm" className={isIndoor ? 'text-purple-600 dark:text-purple-300' : 'text-blue-600 dark:text-blue-300'} />
            </Box>
            <VStack className="flex-1">
              <Text className="text-sm font-semibold text-gray-900 dark:text-white">{item.Name}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {getResultTypeLabel(item.Type)}
                {item.FloorId ? ` - ${t('maps.floor')}` : ''}
              </Text>
            </VStack>
          </HStack>
        </Card>
      </Pressable>
    );
  };

  const renderContent = () => {
    if (query.trim().length === 0) {
      return <ZeroState heading={t('maps.search_maps')} description={t('maps.search')} icon={Search} />;
    }

    if (isLoading) {
      return <Loading text={t('common.loading')} />;
    }

    if (searchResults.length === 0) {
      return <ZeroState heading={t('maps.no_results')} description={t('maps.no_results')} icon={Search} />;
    }

    return <FlatList data={searchResults} renderItem={renderResultItem} keyExtractor={(item) => `${item.Type}-${item.Id}`} contentContainerStyle={{ paddingBottom: 20 }} />;
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        {/* Search input */}
        <Input className="mb-3 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('maps.search_placeholder')} value={query} onChangeText={handleQueryChange} autoFocus />
          {query ? (
            <InputSlot
              className="pr-3"
              onPress={() => {
                setQuery('');
                clearSearch();
              }}
            >
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        {/* Segmented control */}
        <HStack className="mb-4 rounded-lg bg-gray-200 p-1 dark:bg-gray-700" space="xs">
          {SEGMENTS.map((segment) => {
            const isActive = segment.value === activeFilter;
            return (
              <Pressable key={segment.value} onPress={() => handleFilterChange(segment.value)} className={`flex-1 items-center rounded-md px-3 py-2 ${isActive ? 'bg-white shadow-sm dark:bg-gray-600' : ''}`}>
                <Text className={`text-sm font-medium ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{t(segment.labelKey)}</Text>
              </Pressable>
            );
          })}
        </HStack>

        {/* Results */}
        <Box className="flex-1">{renderContent()}</Box>
      </Box>
    </View>
  );
}
