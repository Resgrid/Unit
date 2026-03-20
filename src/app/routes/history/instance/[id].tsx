import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, Stack } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  SkipForward,
  XCircle,
} from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import Mapbox from '@/components/maps/mapbox';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import {
  type RouteDeviationResultData,
  RouteDeviationType,
} from '@/models/v4/routes/routeDeviationResultData';
import {
  type RouteInstanceResultData,
  RouteInstanceStatus,
} from '@/models/v4/routes/routeInstanceResultData';
import {
  type RouteInstanceStopResultData,
  RouteStopStatus,
} from '@/models/v4/routes/routeInstanceStopResultData';
import { useRoutesStore } from '@/stores/routes/store';

// --- Helpers ---

const parseRouteGeometry = (geometry: string) => {
  if (!geometry) return null;
  try {
    const parsed = JSON.parse(geometry);
    if (parsed.type === 'Feature' || parsed.type === 'FeatureCollection') return parsed;
    if (parsed.type === 'LineString' || parsed.type === 'MultiLineString') {
      return { type: 'Feature', properties: {}, geometry: parsed };
    }
    return null;
  } catch {
    return null;
  }
};

const STATUS_COLORS: Record<number, string> = {
  [RouteInstanceStatus.Completed]: '#22c55e',
  [RouteInstanceStatus.Cancelled]: '#ef4444',
  [RouteInstanceStatus.Active]: '#3b82f6',
  [RouteInstanceStatus.Paused]: '#eab308',
  [RouteInstanceStatus.Pending]: '#9ca3af',
};

const STATUS_LABEL_KEYS: Record<number, string> = {
  [RouteInstanceStatus.Pending]: 'routes.pending',
  [RouteInstanceStatus.Active]: 'routes.active',
  [RouteInstanceStatus.Paused]: 'routes.paused',
  [RouteInstanceStatus.Completed]: 'routes.completed',
  [RouteInstanceStatus.Cancelled]: 'routes.cancel_route',
};

const STOP_STATUS_COLORS: Record<number, string> = {
  [RouteStopStatus.Pending]: '#9ca3af',
  [RouteStopStatus.InProgress]: '#3b82f6',
  [RouteStopStatus.Completed]: '#22c55e',
  [RouteStopStatus.Skipped]: '#f59e0b',
};

const DEVIATION_TYPE_LABELS: Record<number, string> = {
  [RouteDeviationType.OffRoute]: 'Off Route',
  [RouteDeviationType.MissedStop]: 'Missed Stop',
  [RouteDeviationType.UnexpectedStop]: 'Unexpected Stop',
  [RouteDeviationType.SpeedViolation]: 'Speed Violation',
  [RouteDeviationType.Other]: 'Other',
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return '--';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getStopIcon(status: number) {
  switch (status) {
    case RouteStopStatus.Completed:
      return CheckCircle;
    case RouteStopStatus.Skipped:
      return SkipForward;
    case RouteStopStatus.InProgress:
      return Navigation;
    default:
      return MapPin;
  }
}

// --- Component ---

export default function RouteInstanceDetail() {
  const { t } = useTranslation();
  const { id: instanceId } = useLocalSearchParams<{ id: string }>();
  const activeInstance = useRoutesStore((state) => state.activeInstance);
  const instanceStops = useRoutesStore((state) => state.instanceStops);
  const deviations = useRoutesStore((state) => state.deviations);
  const activePlan = useRoutesStore((state) => state.activePlan);
  const isLoading = useRoutesStore((state) => state.isLoading);
  const isLoadingStops = useRoutesStore((state) => state.isLoadingStops);
  const error = useRoutesStore((state) => state.error);
  const fetchRouteProgress = useRoutesStore((state) => state.fetchRouteProgress);
  const fetchStopsForInstance = useRoutesStore((state) => state.fetchStopsForInstance);
  const fetchDeviations = useRoutesStore((state) => state.fetchDeviations);
  const fetchRoutePlan = useRoutesStore((state) => state.fetchRoutePlan);

  useFocusEffect(
    useCallback(() => {
      if (instanceId) {
        fetchRouteProgress(instanceId);
        fetchStopsForInstance(instanceId);
        fetchDeviations();
      }
    }, [instanceId, fetchRouteProgress, fetchStopsForInstance, fetchDeviations])
  );

  // Fetch the plan when the instance loads so we can show planned geometry
  useFocusEffect(
    useCallback(() => {
      if (activeInstance?.RoutePlanId) {
        fetchRoutePlan(activeInstance.RoutePlanId);
      }
    }, [activeInstance?.RoutePlanId, fetchRoutePlan])
  );

  // Parse route geometries
  const actualRouteGeoJSON = useMemo(
    () => (activeInstance ? parseRouteGeometry(activeInstance.ActualRouteGeometry) : null),
    [activeInstance?.ActualRouteGeometry]
  );

  const plannedRouteGeoJSON = useMemo(
    () => (activePlan ? parseRouteGeometry(activePlan.MapboxRouteGeometry) : null),
    [activePlan?.MapboxRouteGeometry]
  );

  // Build stop markers GeoJSON
  const stopMarkersGeoJSON = useMemo(() => {
    if (!instanceStops || instanceStops.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: instanceStops
        .filter((s) => s.Latitude && s.Longitude)
        .map((stop) => ({
          type: 'Feature' as const,
          properties: {
            id: stop.RouteInstanceStopId,
            name: stop.Name || `Stop ${stop.StopOrder}`,
            status: stop.Status,
            color: STOP_STATUS_COLORS[stop.Status] ?? '#9ca3af',
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [stop.Longitude, stop.Latitude],
          },
        })),
    };
  }, [instanceStops]);

  // Calculate map bounds from actual route or stops
  const mapBounds = useMemo(() => {
    const coords: [number, number][] = [];

    // Collect coordinates from stops
    instanceStops?.forEach((s) => {
      if (s.Latitude && s.Longitude) {
        coords.push([s.Longitude, s.Latitude]);
      }
    });

    if (coords.length < 2) return null;

    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    return {
      ne: [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005] as [number, number],
      sw: [Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005] as [number, number],
    };
  }, [instanceStops]);

  // Summary stats
  const completedStops = instanceStops.filter(
    (s) => s.Status === RouteStopStatus.Completed
  ).length;
  const totalStops = instanceStops.length;
  const instanceDeviations = deviations.filter(
    (d) => d.RouteInstanceId === instanceId
  );

  if (isLoading && !activeInstance) {
    return (
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen options={{ title: t('routes.instance_detail') }} />
        <Loading text={t('routes.loading')} />
      </View>
    );
  }

  if (error && !activeInstance) {
    return (
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen options={{ title: t('routes.instance_detail') }} />
        <ZeroState heading={t('common.error')} description={error} isError={true} />
      </View>
    );
  }

  if (!activeInstance) {
    return (
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen options={{ title: t('routes.instance_detail') }} />
        <ZeroState heading={t('common.no_results_found')} description={t('routes.no_history_description')} />
      </View>
    );
  }

  const statusColor = STATUS_COLORS[activeInstance.Status] ?? '#9ca3af';
  const statusLabel = t(STATUS_LABEL_KEYS[activeInstance.Status] ?? 'common.unknown');

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <Stack.Screen
        options={{
          title: activeInstance.RoutePlanName || t('routes.instance_detail'),
        }}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Map */}
        <Box className="h-72 overflow-hidden">
          <Mapbox.MapView
            style={{ flex: 1 }}
            styleURL={Mapbox.StyleURL.Street}
            attributionEnabled={false}
            logoEnabled={false}
          >
            {/* Camera fitted to bounds */}
            {mapBounds ? (
              <Mapbox.Camera
                bounds={mapBounds}
                padding={{ paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 }}
                animationDuration={0}
              />
            ) : (
              <Mapbox.Camera zoomLevel={12} animationDuration={0} />
            )}

            {/* Planned route - dashed line */}
            {plannedRouteGeoJSON && (
              <Mapbox.ShapeSource id="plannedRoute" shape={plannedRouteGeoJSON}>
                <Mapbox.LineLayer
                  id="plannedRouteLine"
                  style={{
                    lineColor: '#94a3b8',
                    lineWidth: 3,
                    lineDasharray: [2, 2],
                    lineOpacity: 0.7,
                  }}
                />
              </Mapbox.ShapeSource>
            )}

            {/* Actual route - solid line */}
            {actualRouteGeoJSON && (
              <Mapbox.ShapeSource id="actualRoute" shape={actualRouteGeoJSON}>
                <Mapbox.LineLayer
                  id="actualRouteLine"
                  style={{
                    lineColor: activeInstance.RouteColor || '#3b82f6',
                    lineWidth: 4,
                    lineOpacity: 0.9,
                  }}
                />
              </Mapbox.ShapeSource>
            )}

            {/* Stop markers color-coded by status */}
            {stopMarkersGeoJSON && (
              <Mapbox.ShapeSource id="stopMarkers" shape={stopMarkersGeoJSON}>
                <Mapbox.CircleLayer
                  id="stopMarkerCircles"
                  style={{
                    circleRadius: 8,
                    circleColor: ['get', 'color'],
                    circleStrokeColor: '#ffffff',
                    circleStrokeWidth: 2,
                  }}
                />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>
        </Box>

        {/* Summary Stats */}
        <Box className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <HStack className="items-center justify-between">
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {activeInstance.RoutePlanName || t('routes.route_summary')}
            </Text>
            <Badge style={{ backgroundColor: statusColor }} className="rounded-full">
              <BadgeText className="text-xs font-semibold text-white">
                {statusLabel}
              </BadgeText>
            </Badge>
          </HStack>

          <HStack className="mt-4 justify-around">
            <VStack className="items-center">
              <Icon as={Navigation} size="sm" className="text-gray-500" />
              <Text className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                {formatDistance(activeInstance.TotalDistanceMeters)}
              </Text>
              <Text className="text-xs text-gray-500">{t('routes.distance')}</Text>
            </VStack>

            <VStack className="items-center">
              <Icon as={Clock} size="sm" className="text-gray-500" />
              <Text className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                {formatDuration(activeInstance.TotalDurationSeconds)}
              </Text>
              <Text className="text-xs text-gray-500">{t('routes.duration')}</Text>
            </VStack>

            <VStack className="items-center">
              <Icon as={MapPin} size="sm" className="text-gray-500" />
              <Text className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                {completedStops}/{totalStops}
              </Text>
              <Text className="text-xs text-gray-500">{t('routes.stops')}</Text>
            </VStack>

            <VStack className="items-center">
              <Icon as={AlertTriangle} size="sm" className="text-gray-500" />
              <Text className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                {instanceDeviations.length}
              </Text>
              <Text className="text-xs text-gray-500">{t('routes.deviations')}</Text>
            </VStack>
          </HStack>

          {/* Dates */}
          <VStack className="mt-4 space-y-1 border-t border-gray-200 pt-3 dark:border-gray-700">
            <HStack className="justify-between">
              <Text className="text-sm text-gray-500">{t('routes.in_progress')}</Text>
              <Text className="text-sm text-gray-700 dark:text-gray-300">
                {formatDate(activeInstance.StartedOn)}
              </Text>
            </HStack>
            {activeInstance.CompletedOn ? (
              <HStack className="justify-between">
                <Text className="text-sm text-gray-500">{t('routes.completed')}</Text>
                <Text className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDate(activeInstance.CompletedOn)}
                </Text>
              </HStack>
            ) : null}
            {activeInstance.CancelledOn ? (
              <HStack className="justify-between">
                <Text className="text-sm text-gray-500">{t('routes.cancel_route')}</Text>
                <Text className="text-sm text-gray-700 dark:text-gray-300">
                  {formatDate(activeInstance.CancelledOn)}
                </Text>
              </HStack>
            ) : null}
          </VStack>
        </Box>

        {/* Stops List */}
        {isLoadingStops ? (
          <Box className="mx-4 mt-4">
            <Loading text={t('routes.loading_stops')} />
          </Box>
        ) : instanceStops.length > 0 ? (
          <Box className="mx-4 mt-4">
            <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-100">
              {t('routes.stops')}
            </Heading>
            {instanceStops
              .sort((a, b) => a.StopOrder - b.StopOrder)
              .map((stop) => (
                <StopCard key={stop.RouteInstanceStopId} stop={stop} />
              ))}
          </Box>
        ) : null}

        {/* Deviations List */}
        {instanceDeviations.length > 0 && (
          <Box className="mx-4 mt-4">
            <Heading size="sm" className="mb-3 text-gray-900 dark:text-gray-100">
              {t('routes.deviations')}
            </Heading>
            {instanceDeviations.map((deviation) => (
              <DeviationCard key={deviation.RouteDeviationId} deviation={deviation} />
            ))}
          </Box>
        )}
      </ScrollView>
    </View>
  );
}

// --- Sub-components ---

function StopCard({ stop }: { stop: RouteInstanceStopResultData }) {
  const statusColor = STOP_STATUS_COLORS[stop.Status] ?? '#9ca3af';
  const StopIcon = getStopIcon(stop.Status);

  return (
    <Box className="mb-2 rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
      <HStack className="items-center space-x-3">
        <Box
          className="size-8 items-center justify-center rounded-full"
          style={{ backgroundColor: statusColor + '20' }}
        >
          <Icon as={StopIcon} size="xs" style={{ color: statusColor }} />
        </Box>
        <VStack className="flex-1">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {stop.Name || `Stop ${stop.StopOrder}`}
          </Text>
          {stop.Address ? (
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {stop.Address}
            </Text>
          ) : null}
          <HStack className="mt-1 space-x-3">
            {stop.CheckedInOn ? (
              <Text className="text-xs text-gray-500">
                In: {formatDate(stop.CheckedInOn)}
              </Text>
            ) : null}
            {stop.CheckedOutOn ? (
              <Text className="text-xs text-gray-500">
                Out: {formatDate(stop.CheckedOutOn)}
              </Text>
            ) : null}
            {stop.SkippedOn ? (
              <Text className="text-xs text-gray-500">
                Skipped: {formatDate(stop.SkippedOn)}
              </Text>
            ) : null}
          </HStack>
        </VStack>
        <Text className="text-xs font-medium" style={{ color: statusColor }}>
          #{stop.StopOrder}
        </Text>
      </HStack>
    </Box>
  );
}

function DeviationCard({ deviation }: { deviation: RouteDeviationResultData }) {
  const { t } = useTranslation();
  const typeLabel = DEVIATION_TYPE_LABELS[deviation.Type] ?? t('routes.deviation');

  return (
    <Box className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
      <HStack className="items-start space-x-3">
        <Icon as={AlertTriangle} size="sm" className="mt-0.5 text-red-500" />
        <VStack className="flex-1">
          <HStack className="items-center justify-between">
            <Text className="text-sm font-semibold text-red-800 dark:text-red-200">
              {typeLabel}
            </Text>
            {deviation.IsAcknowledged && (
              <Badge className="rounded-full bg-green-100 dark:bg-green-800">
                <BadgeText className="text-xs text-green-700 dark:text-green-200">
                  {t('routes.acknowledge')}
                </BadgeText>
              </Badge>
            )}
          </HStack>
          {deviation.Description ? (
            <Text className="mt-1 text-xs text-red-700 dark:text-red-300">
              {deviation.Description}
            </Text>
          ) : null}
          <Text className="mt-1 text-xs text-red-500">
            {formatDate(deviation.OccurredOn)}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
}
