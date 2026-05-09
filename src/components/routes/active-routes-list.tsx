import { router } from 'expo-router';
import { MapPin, Navigation, Route, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import { RouteCard } from '@/components/routes/route-card';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { type RoutePlanResultData } from '@/models/v4/routes/routePlanResultData';
import { useCoreStore } from '@/stores/app/core-store';
import { useRoutesStore } from '@/stores/routes/store';
import { useUnitsStore } from '@/stores/units/store';

export const ActiveRoutesList: React.FC = () => {
  const { t } = useTranslation();
  const routePlans = useRoutesStore((state) => state.routePlans);
  const activeInstance = useRoutesStore((state) => state.activeInstance);
  const isLoading = useRoutesStore((state) => state.isLoading);
  const error = useRoutesStore((state) => state.error);
  const fetchAllRoutePlans = useRoutesStore((state) => state.fetchAllRoutePlans);
  const fetchActiveRoute = useRoutesStore((state) => state.fetchActiveRoute);
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const units = useUnitsStore((state) => state.units);
  const fetchUnits = useUnitsStore((state) => state.fetchUnits);
  const [searchQuery, setSearchQuery] = useState('');

  const unitMap = useMemo(() => Object.fromEntries(units.map((unit) => [unit.UnitId, unit.Name])), [units]);

  useEffect(() => {
    fetchAllRoutePlans();
    if (activeUnitId) {
      fetchActiveRoute(activeUnitId);
    }
    if (units.length === 0) {
      fetchUnits();
    }
  }, [activeUnitId, fetchActiveRoute, fetchAllRoutePlans, fetchUnits, units.length]);

  const handleRefresh = () => {
    fetchAllRoutePlans();
    if (activeUnitId) {
      fetchActiveRoute(activeUnitId);
    }
  };

  const activeRouteBanner = activeInstance ? (
    <Pressable
      onPress={() => {
        const routeInstanceId = activeInstance.RouteInstanceId;
        const activeRouteUrl =
          routeInstanceId && routeInstanceId !== 'undefined' ? `/routes/active?planId=${activeInstance.RoutePlanId}&instanceId=${routeInstanceId}` : `/routes/active?planId=${activeInstance.RoutePlanId}`;
        router.push(activeRouteUrl as any);
      }}
    >
      <Box className="mb-3 rounded-xl border-2 border-green-500 bg-green-50 p-4 dark:bg-green-900/20">
        <HStack className="items-center justify-between">
          <HStack className="items-center space-x-2">
            <Navigation size={20} color="#22c55e" />
            <Text className="text-base font-bold text-green-800 dark:text-green-200">{activeInstance.RoutePlanName || t('routes.active_route')}</Text>
          </HStack>
          <Badge className="bg-green-500">
            <BadgeText className="text-white">{t('routes.active')}</BadgeText>
          </Badge>
        </HStack>
        <Text className="mt-1 text-sm text-green-700 dark:text-green-300">
          {t('routes.progress', {
            percent: activeInstance.StopsTotal ? Math.round(((activeInstance.StopsCompleted ?? 0) / activeInstance.StopsTotal) * 100) : 0,
          })}
        </Text>
      </Box>
    </Pressable>
  ) : null;

  const handleRoutePress = (route: RoutePlanResultData) => {
    if (activeInstance && activeInstance.RoutePlanId === route.RoutePlanId) {
      const routeInstanceId = activeInstance.RouteInstanceId;
      const activeRouteUrl = routeInstanceId && routeInstanceId !== 'undefined' ? `/routes/active?planId=${route.RoutePlanId}&instanceId=${routeInstanceId}` : `/routes/active?planId=${route.RoutePlanId}`;
      router.push(activeRouteUrl as any);
      return;
    }

    router.push(`/routes/start?planId=${route.RoutePlanId}` as any);
  };

  const filteredRoutes = useMemo(() => {
    const activeRoutes = routePlans.filter((route) => route.RouteStatus === 1);
    if (!searchQuery) {
      return activeRoutes;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    return activeRoutes.filter((route) => {
      const isRouteMyUnit = route.UnitId != null && String(route.UnitId) === String(activeUnitId);
      const unitName = route.UnitId != null ? unitMap[route.UnitId] || (isRouteMyUnit ? (activeUnit?.Name ?? '') : '') : '';
      return route.Name.toLowerCase().includes(normalizedQuery) || (route.Description?.toLowerCase() || '').includes(normalizedQuery) || unitName.toLowerCase().includes(normalizedQuery);
    });
  }, [activeUnit, activeUnitId, routePlans, searchQuery, unitMap]);

  if (isLoading) {
    return <Loading text={t('routes.loading')} />;
  }

  if (error) {
    return (
      <Box className="flex-1 items-center justify-center px-8">
        <View className="mb-5 items-center justify-center rounded-full bg-red-100 p-5 dark:bg-red-900/30">
          <MapPin size={40} color="#ef4444" />
        </View>
        <Text className="mb-1.5 text-center text-xl font-bold text-gray-900 dark:text-white">{t('common.errorOccurred')}</Text>
        <Text className="text-center text-base leading-5 text-gray-500 dark:text-gray-400">{error}</Text>
      </Box>
    );
  }

  return (
    <Box className="flex-1">
      <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
        <InputSlot className="pl-3">
          <InputIcon as={Search} />
        </InputSlot>
        <InputField placeholder={t('routes.search')} value={searchQuery} onChangeText={setSearchQuery} />
        {searchQuery ? (
          <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
            <InputIcon as={X} />
          </InputSlot>
        ) : null}
      </Input>

      {filteredRoutes.length > 0 || activeInstance ? (
        <Box className="flex-1">
          <FlatList<RoutePlanResultData>
            testID="routes-list"
            data={filteredRoutes}
            ListHeaderComponent={activeRouteBanner}
            renderItem={({ item }) => {
              const isMyUnit = item.UnitId != null && String(item.UnitId) === String(activeUnitId);
              const unitName = item.UnitId != null ? unitMap[item.UnitId] || (isMyUnit ? (activeUnit?.Name ?? '') : '') : '';
              return (
                <Pressable onPress={() => handleRoutePress(item)}>
                  <RouteCard route={item} isActive={!!activeInstance && activeInstance.RoutePlanId === item.RoutePlanId} unitName={unitName || undefined} isMyUnit={isMyUnit} />
                </Pressable>
              );
            }}
            keyExtractor={(item) => item.RoutePlanId}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              searchQuery ? (
                <Box className="flex-1 items-center justify-center px-8 py-12">
                  <View className="mb-6 items-center justify-center">
                    <View className="absolute size-32 rounded-full bg-orange-50 dark:bg-orange-900/20" />
                    <View className="absolute size-20 rounded-full bg-orange-100 dark:bg-orange-900/30" />
                    <View className="size-14 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/30">
                      <Search size={28} color="#ffffff" />
                    </View>
                  </View>
                  <Text className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-white">{t('routes.no_search_results', 'No routes found')}</Text>
                  <Text className="max-w-[280] text-center text-base leading-5 text-gray-500 dark:text-gray-400">{t('routes.try_different_search', 'Try a different search term')}</Text>
                </Box>
              ) : (
                <Box className="flex-1 items-center justify-center px-8 py-12">
                  <View className="mb-6 items-center justify-center">
                    <View className="absolute size-32 rounded-full bg-indigo-50 dark:bg-indigo-900/20" />
                    <View className="absolute size-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
                    <View className="size-14 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30">
                      <Route size={28} color="#ffffff" />
                    </View>
                  </View>
                  <Text className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-white">{t('routes.no_routes')}</Text>
                  <Text className="mb-6 max-w-[280] text-center text-base leading-5 text-gray-500 dark:text-gray-400">{t('routes.no_routes_description_all')}</Text>
                  <HStack className="items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800">
                    <MapPin size={14} color="#6366f1" />
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{t('routes.pull_to_refresh', 'Pull down to refresh')}</Text>
                  </HStack>
                </Box>
              )
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </Box>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />} contentContainerClassName="flex-1" showsVerticalScrollIndicator={false}>
          <Box className="flex-1 items-center justify-center px-8">
            {/* Decorative background circle */}
            <View className="mb-6 items-center justify-center">
              <View className="absolute size-32 rounded-full bg-indigo-50 dark:bg-indigo-900/20" />
              <View className="absolute size-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
              <View className="size-14 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30">
                <Route size={28} color="#ffffff" />
              </View>
            </View>

            <Text className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-white">{searchQuery ? t('routes.no_search_results', 'No routes found') : t('routes.no_routes')}</Text>
            <Text className="mb-6 max-w-[280] text-center text-base leading-5 text-gray-500 dark:text-gray-400">
              {searchQuery ? t('routes.try_different_search', 'Try a different search term') : t('routes.no_routes_description_all')}
            </Text>

            {!searchQuery ? (
              <HStack className="items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800">
                <MapPin size={14} color="#6366f1" />
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('routes.pull_to_refresh', 'Pull down to refresh')}</Text>
              </HStack>
            ) : null}
          </Box>
        </ScrollView>
      )}
    </Box>
  );
};
