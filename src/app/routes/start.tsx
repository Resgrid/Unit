import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Info, MapPin, Navigation, Phone, Play, Truck, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { Camera, MapView, PointAnnotation, StyleURL } from '@/components/maps/mapbox';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type RouteStopResultData } from '@/models/v4/routes/routePlanResultData';
import { useCoreStore } from '@/stores/app/core-store';
import { useRoutesStore } from '@/stores/routes/store';
import { useUnitsStore } from '@/stores/units/store';

const formatDateTime = (isoString: string | null | undefined): string | null => {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

const formatDistance = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

interface StopMarkerProps {
  order: number;
  name: string;
  color: string;
}

function StopMarker({ order, name, color }: StopMarkerProps) {
  return (
    <View style={styles.markerContainer}>
      <View style={[styles.markerCircle, { backgroundColor: color }]}>
        <RNText style={styles.markerNumber}>{order}</RNText>
      </View>
      <View style={styles.markerLabel}>
        <RNText style={styles.markerLabelText} numberOfLines={1}>
          {name}
        </RNText>
      </View>
    </View>
  );
}

export default function RouteViewScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const activePlan = useRoutesStore((state) => state.activePlan);
  const isLoading = useRoutesStore((state) => state.isLoading);
  const error = useRoutesStore((state) => state.error);
  const fetchRoutePlan = useRoutesStore((state) => state.fetchRoutePlan);
  const startRouteInstance = useRoutesStore((state) => state.startRouteInstance);
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const units = useUnitsStore((state) => state.units);
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();

  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.UnitId, u.Name])),
    [units]
  );

  useEffect(() => {
    if (planId) fetchRoutePlan(planId);
  }, [planId, fetchRoutePlan]);

  const sortedStops = useMemo(
    () => [...(activePlan?.Stops || [])].sort((a, b) => a.StopOrder - b.StopOrder),
    [activePlan]
  );

  const mapData = useMemo(() => {
    const valid = sortedStops.filter((s) => s.Latitude && s.Longitude);
    if (valid.length === 0) return null;

    const lats = valid.map((s) => s.Latitude);
    const lngs = valid.map((s) => s.Longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    const zoom = span === 0 ? 14 : Math.max(6, Math.min(14, Math.round(Math.log2(0.5 / span)) + 10));

    return { center: [centerLng, centerLat] as [number, number], zoom, stops: valid };
  }, [sortedStops]);

  const markerColor = activePlan?.RouteColor || '#3b82f6';

  const assignedUnitName = activePlan?.UnitId != null
    ? (unitMap[activePlan.UnitId] || (String(activePlan.UnitId) === String(activeUnitId) ? (activeUnit?.Name ?? '') : ''))
    : null;

  // A unit can start this route if:
  // 1. The route has no pre-assigned unit (will assign on start), OR
  // 2. The route is assigned to the current active unit
  // UnitId from API is a number; activeUnitId is a string — compare as strings.
  const canStart = !!activeUnitId && (!activePlan?.UnitId || String(activePlan.UnitId) === String(activeUnitId));

  const handleStartRoute = async () => {
    if (!planId || !activeUnitId) return;
    try {
      await startRouteInstance(planId, activeUnitId);
      router.replace(`/routes/active?planId=${planId}`);
    } catch {
      Alert.alert(t('common.error'), t('common.errorOccurred'));
    }
  };

  if (isLoading) {
    return (
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <FocusAwareStatusBar />
        <Loading text={t('routes.loading')} />
      </View>
    );
  }

  if (error || !activePlan) {
    return (
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <FocusAwareStatusBar />
        <ZeroState
          heading={t('routes.no_routes')}
          description={error || t('routes.no_routes_description')}
          isError={!!error}
        />
      </View>
    );
  }

  const renderStopRow = (stop: RouteStopResultData, index: number) => {
    const plannedArrival = formatDateTime(stop.PlannedArrival);
    const plannedDeparture = formatDateTime(stop.PlannedDeparture);

    return (
      <React.Fragment key={stop.RouteStopId}>
        <HStack className="items-start gap-3 py-3">
          {/* Order badge */}
          <View
            style={[styles.stopBadge, { backgroundColor: markerColor }]}
          >
            <RNText style={styles.stopBadgeText}>{stop.StopOrder}</RNText>
          </View>

          <VStack className="flex-1 gap-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{stop.Name}</Text>

            {stop.Address ? (
              <HStack className="items-center gap-1.5">
                <Icon as={MapPin} size="xs" className="text-gray-400" />
                <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={2}>
                  {stop.Address}
                </Text>
              </HStack>
            ) : null}

            {plannedArrival ? (
              <HStack className="items-center gap-1.5">
                <Icon as={Clock} size="xs" className="text-blue-400" />
                <Text className="text-xs text-gray-600 dark:text-gray-400">
                  {t('routes.planned_arrival')}: {plannedArrival}
                </Text>
              </HStack>
            ) : null}

            {plannedDeparture ? (
              <HStack className="items-center gap-1.5">
                <Icon as={Clock} size="xs" className="text-purple-400" />
                <Text className="text-xs text-gray-600 dark:text-gray-400">
                  {t('routes.planned_departure')}: {plannedDeparture}
                </Text>
              </HStack>
            ) : null}

            {stop.DwellTimeMinutes > 0 ? (
              <HStack className="items-center gap-1.5">
                <Icon as={Clock} size="xs" className="text-gray-400" />
                <Text className="text-xs text-gray-500 dark:text-gray-500">
                  {stop.DwellTimeMinutes} {t('routes.dwell_time')}
                </Text>
              </HStack>
            ) : null}

            {stop.Notes ? (
              <Text className="text-xs italic text-gray-500 dark:text-gray-400">{stop.Notes}</Text>
            ) : null}

            {stop.ContactId ? (
              <Pressable
                onPress={() =>
                  router.push(`/routes/stop/contact?stopId=${stop.RouteStopId}` as any)
                }
              >
                <HStack className="mt-1 items-center gap-1.5">
                  <Icon as={User} size="xs" className="text-blue-500" />
                  <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {t('routes.view_contact')}
                  </Text>
                </HStack>
              </Pressable>
            ) : null}
          </VStack>
        </HStack>
        {index < sortedStops.length - 1 ? <Divider className="ml-12" /> : null}
      </React.Fragment>
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Interactive stop map */}
        {mapData ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              styleURL={colorScheme === 'dark' ? StyleURL.Dark : StyleURL.Street}
              logoEnabled={false}
              attributionEnabled={false}
              initialCenter={mapData.center}
              initialZoom={mapData.zoom}
            >
              <Camera centerCoordinate={mapData.center} zoomLevel={mapData.zoom} animationDuration={0} />
              {mapData.stops.map((stop) => (
                <PointAnnotation
                  key={stop.RouteStopId}
                  id={`stop-${stop.RouteStopId}`}
                  coordinate={[stop.Longitude, stop.Latitude]}
                >
                  <StopMarker order={stop.StopOrder} name={stop.Name} color={markerColor} />
                </PointAnnotation>
              ))}
            </MapView>
          </View>
        ) : null}

        <Box className="px-4 pt-4">
          {/* Route header */}
          <Box
            className="rounded-xl bg-white p-5 shadow-sm dark:bg-gray-800"
            style={{ borderLeftWidth: 4, borderLeftColor: markerColor }}
          >
            <HStack className="items-center gap-2">
              <Icon as={Navigation} size="md" className="text-blue-500" />
              <Text className="text-xl font-bold text-gray-900 dark:text-white">{activePlan.Name}</Text>
            </HStack>

            {/* Description */}
            {activePlan.Description ? (
              <Text className="mt-2 text-sm text-gray-600 dark:text-gray-400">{activePlan.Description}</Text>
            ) : null}

            {/* Assigned unit */}
            <HStack className="mt-2 items-center gap-1.5">
              <Icon as={Truck} size="xs" className={assignedUnitName ? 'text-blue-500' : 'text-gray-400'} />
              <Text className={`text-sm font-medium ${assignedUnitName ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {assignedUnitName || t('routes.unassigned')}
              </Text>
            </HStack>

            <HStack className="mt-4 gap-3">
              <VStack className="items-center rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-700">
                <Text className="text-lg font-bold text-blue-600 dark:text-blue-400">{sortedStops.length}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('routes.stops')}</Text>
              </VStack>

              {(activePlan.EstimatedDistanceMeters ?? 0) > 0 ? (
                <VStack className="items-center rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-700">
                  <Text className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatDistance(activePlan.EstimatedDistanceMeters!)}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{t('routes.distance')}</Text>
                </VStack>
              ) : null}

              {(activePlan.EstimatedDurationSeconds ?? 0) > 0 ? (
                <VStack className="items-center rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-700">
                  <Text className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatDuration(activePlan.EstimatedDurationSeconds!)}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{t('routes.duration')}</Text>
                </VStack>
              ) : null}
            </HStack>

            {activePlan.ScheduleInfo ? (
              <HStack className="mt-3 items-center gap-1.5">
                <Icon as={Clock} size="xs" className="text-blue-500" />
                <Text className="text-sm text-blue-600 dark:text-blue-400">{activePlan.ScheduleInfo}</Text>
              </HStack>
            ) : null}
          </Box>

          {/* Warning when route is assigned to a different unit */}
          {activePlan.UnitId && String(activePlan.UnitId) !== String(activeUnitId) ? (
            <Box className="mt-4 rounded-xl bg-amber-50 p-4 shadow-sm dark:bg-amber-900/20">
              <HStack className="items-center gap-2">
                <Icon as={Info} size="sm" className="text-amber-500" />
                <Text className="flex-1 text-sm text-amber-700 dark:text-amber-300">
                  {t('routes.assigned_other_unit')}
                </Text>
              </HStack>
            </Box>
          ) : null}

          {/* Stops list */}
          <Box className="mt-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <Text className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
              {t('routes.stops')} ({sortedStops.length})
            </Text>
            <Divider className="mb-2" />

            {sortedStops.length > 0 ? (
              <VStack>{sortedStops.map((stop, index) => renderStopRow(stop, index))}</VStack>
            ) : (
              <Text className="py-4 text-center text-gray-500 dark:text-gray-400">
                {t('routes.no_stops')}
              </Text>
            )}
          </Box>
        </Box>
      </ScrollView>

      {/* Start Route button — only shown when this unit can start */}
      {canStart ? (
        <Box className="border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
          <Button
            size="xl"
            className="w-full bg-green-600"
            onPress={handleStartRoute}
            isDisabled={isLoading}
            testID="start-route-button"
          >
            <ButtonIcon as={Play} className="mr-2 text-white" />
            <ButtonText className="text-lg font-bold text-white">{t('routes.start_route')}</ButtonText>
          </Button>
        </Box>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 260,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  markerNumber: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  markerLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  markerLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1f2937',
  },
  stopBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stopBadgeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
