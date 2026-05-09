import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { ActiveRoutesList } from '@/components/routes/active-routes-list';
import { FilterProvider, useFilterContext } from '@/components/routes/filter-context';
import { PoiListContent } from '@/components/routes/poi-list-content';
import { Box } from '@/components/ui/box';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { SharedTabs, type TabItem } from '@/components/ui/shared-tabs';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type PoiSortOption } from '@/lib/poi-utils';
import { usePoisStore } from '@/stores/pois/store';
import { Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

const FilterSheet: React.FC = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const poiTypes = usePoisStore((state) => state.poiTypes);
  const { isFilterOpen, selectedPoiTypeId, sortBy, closeFilter, setSelectedPoiTypeId, setSortBy } = useFilterContext();

  const sortOptions: { label: string; value: PoiSortOption }[] = [
    { label: t('routes.poi_sort_display'), value: 'display' },
    { label: t('routes.poi_sort_type'), value: 'type' },
  ];

  const handlePoiTypeSelect = (id: number | null) => {
    setSelectedPoiTypeId(id);
  };

  const handleSortSelect = (option: PoiSortOption) => {
    setSortBy(option);
  };

  return (
    <CustomBottomSheet isOpen={isFilterOpen} onClose={closeFilter} snapPoints={[55]}>
      <VStack space="lg" className="w-full">
        <Heading size="lg">{t('routes.poi_filters')}</Heading>

        {/* POI Type Filter */}
        <VStack space="sm">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('routes.poi_filter_type')}</Text>
          <VStack space="xs">
            <ScrollView
              style={{ maxHeight: 250 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              bounces={false}
            >
              <VStack space="xs">
                <Pressable
                  onPress={() => handlePoiTypeSelect(null)}
                  className={`flex-row items-center justify-between rounded-lg border p-3 ${
                    selectedPoiTypeId === null
                      ? isDark
                        ? 'border-primary-700 bg-primary-900/30'
                        : 'border-primary-500 bg-primary-50'
                      : isDark
                        ? 'border-neutral-700 bg-neutral-800'
                        : 'border-neutral-200 bg-white'
                  }`}
                >
                  <HStack space="sm" className="items-center">
                    <Text className={selectedPoiTypeId === null ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-typography-900'}>
                      {t('routes.poi_filter_all_types')}
                    </Text>
                  </HStack>
                  {selectedPoiTypeId === null && <Check size={18} color={isDark ? '#60a5fa' : '#2563eb'} />}
                </Pressable>

                {poiTypes.map((poiType) => (
                  <Pressable
                    key={poiType.PoiTypeId}
                    onPress={() => handlePoiTypeSelect(poiType.PoiTypeId)}
                    className={`flex-row items-center justify-between rounded-lg border p-3 ${
                      selectedPoiTypeId === poiType.PoiTypeId
                        ? isDark
                          ? 'border-primary-700 bg-primary-900/30'
                          : 'border-primary-500 bg-primary-50'
                        : isDark
                          ? 'border-neutral-700 bg-neutral-800'
                          : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <Text className={selectedPoiTypeId === poiType.PoiTypeId ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-typography-900'}>
                      {poiType.Name}
                    </Text>
                    {selectedPoiTypeId === poiType.PoiTypeId && <Check size={18} color={isDark ? '#60a5fa' : '#2563eb'} />}
                  </Pressable>
                ))}
              </VStack>
            </ScrollView>
          </VStack>
        </VStack>

        {/* Sort Options */}
        <VStack space="sm">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('routes.poi_sort_by')}</Text>
          <VStack space="xs">
            {sortOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => handleSortSelect(option.value)}
                className={`flex-row items-center justify-between rounded-lg border p-3 ${
                  sortBy === option.value
                    ? isDark
                      ? 'border-primary-700 bg-primary-900/30'
                      : 'border-primary-500 bg-primary-50'
                    : isDark
                      ? 'border-neutral-700 bg-neutral-800'
                      : 'border-neutral-200 bg-white'
                }`}
              >
                <Text className={sortBy === option.value ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-typography-900'}>
                  {option.label}
                </Text>
                {sortBy === option.value && <Check size={18} color={isDark ? '#60a5fa' : '#2563eb'} />}
              </Pressable>
            ))}
          </VStack>
        </VStack>
      </VStack>
    </CustomBottomSheet>
  );
};

export const RoutesHome: React.FC = () => {
  const tabs = React.useMemo<TabItem[]>(
    () => [
      {
        key: 'routes',
        title: 'routes.routes_tab',
        content: <ActiveRoutesList />,
      },
      {
        key: 'pois',
        title: 'routes.pois_tab',
        content: <PoiListContent />,
      },
    ],
    []
  );

  return (
    <FilterProvider>
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <Box className="flex-1 px-4 pt-4">
          <SharedTabs tabs={tabs} scrollable={false} variant="segmented" className="flex-1" contentClassName="pt-4" />
        </Box>
        <FilterSheet />
      </View>
    </FilterProvider>
  );
};
