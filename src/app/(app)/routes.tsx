import { router } from 'expo-router';
import { Navigation, PlusIcon, RefreshCcwDotIcon, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { RouteCard } from '@/components/routes/route-card';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Fab, FabIcon } from '@/components/ui/fab';
import { FlatList } from '@/components/ui/flat-list';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { type RoutePlanResultData } from '@/models/v4/routes/routePlanResultData';
import { useCoreStore } from '@/stores/app/core-store';
import { useRoutesStore } from '@/stores/routes/store';
import { useUnitsStore } from '@/stores/units/store';

export default function Routes() {
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

  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.UnitId, u.Name])),
    [units]
  );

  useEffect(() => {
    fetchAllRoutePlans();
    if (activeUnitId) {
      fetchActiveRoute(activeUnitId);
    }
    if (units.length === 0) {
      fetchUnits();
    }
  }, [activeUnitId, fetchAllRoutePlans, fetchActiveRoute, fetchUnits, units.length]);

  const handleRefresh = () => {
    fetchAllRoutePlans();
    if (activeUnitId) {
      fetchActiveRoute(activeUnitId);
    }
  };

  const handleRoutePress = (route: RoutePlanResultData) => {
    if (activeInstance && activeInstance.RoutePlanId === route.RoutePlanId) {
      const iid = activeInstance.RouteInstanceId;
      const url = iid && iid !== 'undefined'
        ? `/routes/active?planId=${route.RoutePlanId}&instanceId=${iid}`
        : `/routes/active?planId=${route.RoutePlanId}`;
      router.push(url as any);
    } else {
      router.push(`/routes/start?planId=${route.RoutePlanId}` as any);
    }
  };

  const filteredRoutes = useMemo(() => {
    const active = routePlans.filter((route) => route.RouteStatus === 1);
    if (!searchQuery) return active;
    const q = searchQuery.toLowerCase();
    return active.filter((route) => {
      const isRouteMyUnit = route.UnitId != null && String(route.UnitId) === String(activeUnitId);
      const unitName = route.UnitId != null ? (unitMap[route.UnitId] || (isRouteMyUnit ? (activeUnit?.Name ?? '') : '')) : '';
      return (
        route.Name.toLowerCase().includes(q) ||
        (route.Description?.toLowerCase() || '').includes(q) ||
        unitName.toLowerCase().includes(q)
      );
    });
  }, [routePlans, searchQuery, unitMap, activeUnitId, activeUnit]);

  const renderContent = () => {
    if (isLoading) {
      return <Loading text={t('routes.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    return (
      <FlatList<RoutePlanResultData>
        testID="routes-list"
        data={filteredRoutes}
        ListHeaderComponent={
          activeInstance ? (
            <Pressable
              onPress={() => {
                const iid = activeInstance.RouteInstanceId;
                const url = iid && iid !== 'undefined'
                  ? `/routes/active?planId=${activeInstance.RoutePlanId}&instanceId=${iid}`
                  : `/routes/active?planId=${activeInstance.RoutePlanId}`;
                router.push(url as any);
              }}
            >
              <Box className="mb-3 rounded-xl border-2 border-green-500 bg-green-50 p-4 dark:bg-green-900/20">
                <HStack className="items-center justify-between">
                  <HStack className="items-center space-x-2">
                    <Navigation size={20} color="#22c55e" />
                    <Text className="text-base font-bold text-green-800 dark:text-green-200">
                      {activeInstance.RoutePlanName || t('routes.active_route')}
                    </Text>
                  </HStack>
                  <Badge className="bg-green-500">
                    <BadgeText className="text-white">{t('routes.active')}</BadgeText>
                  </Badge>
                </HStack>
                <Text className="mt-1 text-sm text-green-700 dark:text-green-300">
                  {t('routes.progress', {
                    percent: activeInstance.StopsTotal
                      ? Math.round(((activeInstance.StopsCompleted ?? 0) / activeInstance.StopsTotal) * 100)
                      : 0,
                  })}
                </Text>
              </Box>
            </Pressable>
          ) : null
        }
        renderItem={({ item }: { item: RoutePlanResultData }) => {
          const isMyUnit = item.UnitId != null && String(item.UnitId) === String(activeUnitId);
          const unitName = item.UnitId != null
            ? (unitMap[item.UnitId] || (isMyUnit ? (activeUnit?.Name ?? '') : ''))
            : '';
          return (
            <Pressable onPress={() => handleRoutePress(item)}>
              <RouteCard
                route={item}
                isActive={!!activeInstance && activeInstance.RoutePlanId === item.RoutePlanId}
                unitName={unitName || undefined}
                isMyUnit={isMyUnit}
              />
            </Pressable>
          );
        }}
        keyExtractor={(item: RoutePlanResultData) => item.RoutePlanId}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <ZeroState
            heading={t('routes.no_routes')}
            description={t('routes.no_routes_description_all')}
            icon={RefreshCcwDotIcon}
          />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <Box className="flex-1 px-4 pt-4">
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

        <Box className="flex-1">{renderContent()}</Box>

        <Fab size="lg" onPress={() => router.push('/routes/start' as any)} testID="new-route-fab">
          <FabIcon as={PlusIcon} size="lg" />
        </Fab>
      </Box>
    </View>
  );
}
