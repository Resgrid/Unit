import { useLocalSearchParams, useRouter } from 'expo-router';
import { Compass, LogOut, Navigation, SkipForward } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import Mapbox from '@/components/maps/mapbox';
import { RouteDeviationBanner } from '@/components/routes/route-deviation-banner';
import { StopCard } from '@/components/routes/stop-card';
import { StopMarker } from '@/components/routes/stop-marker';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { Env } from '@/lib/env';
import { RouteStopStatus } from '@/models/v4/routes/routeInstanceStopResultData';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useRoutesStore } from '@/stores/routes/store';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

const POLL_INTERVAL_MS = 30_000;
const GEOFENCE_CIRCLE_STEPS = 64;

/**
 * Parse route geometry string into a GeoJSON Feature suitable for Mapbox rendering.
 */
const parseRouteGeometry = (geometry: string): GeoJSON.Feature | null => {
  if (!geometry) return null;
  try {
    const parsed = JSON.parse(geometry);
    if (parsed.type === 'Feature' || parsed.type === 'FeatureCollection') return parsed;
    if (parsed.type === 'LineString' || parsed.type === 'MultiLineString') {
      return { type: 'Feature', properties: {}, geometry: parsed };
    }
    if (Array.isArray(parsed)) {
      return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: parsed } };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Build a GeoJSON circle polygon for a geofence around a coordinate.
 */
const buildGeofenceCircle = (lng: number, lat: number, radiusMeters: number, steps: number = GEOFENCE_CIRCLE_STEPS): GeoJSON.Feature => {
  const coords: number[][] = [];
  const distanceLat = radiusMeters / 111_320;
  const distanceLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([lng + distanceLng * Math.cos(angle), lat + distanceLat * Math.sin(angle)]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
};

export default function ActiveRouteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { planId, instanceId } = useLocalSearchParams<{ planId: string; instanceId: string }>();
  const cameraRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [skipModalVisible, setSkipModalVisible] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  // --- Stores ---
  const activeUnitId = useCoreStore((s) => s.activeUnitId);
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);

  const activeInstance = useRoutesStore((s) => s.activeInstance);
  const instanceStops = useRoutesStore((s) => s.instanceStops);
  const directions = useRoutesStore((s) => s.directions);
  const deviations = useRoutesStore((s) => s.deviations);
  const isLoadingStops = useRoutesStore((s) => s.isLoadingStops);
  const fetchStopsForInstance = useRoutesStore((s) => s.fetchStopsForInstance);
  const fetchDirections = useRoutesStore((s) => s.fetchDirections);
  const fetchRouteProgress = useRoutesStore((s) => s.fetchRouteProgress);
  const fetchDeviations = useRoutesStore((s) => s.fetchDeviations);
  const endRouteInstance = useRoutesStore((s) => s.endRouteInstance);
  const checkIn = useRoutesStore((s) => s.checkIn);
  const checkOut = useRoutesStore((s) => s.checkOut);
  const skip = useRoutesStore((s) => s.skip);
  const ackDeviation = useRoutesStore((s) => s.ackDeviation);

  // instanceId may be absent when navigating from start.tsx — fall back to store.
  // Guard against the literal string "undefined" that can appear in URL params.
  const resolvedInstanceId = (() => {
    const id = instanceId && instanceId !== 'undefined' ? instanceId : activeInstance?.RouteInstanceId;
    return id || undefined;
  })();

  // --- Derived data ---
  const currentStop = useMemo(() => instanceStops.find((s) => s.Status === RouteStopStatus.Pending || s.Status === RouteStopStatus.InProgress) ?? null, [instanceStops]);

  const routeColor = activeInstance?.RouteColor || '#3b82f6';

  const progressPercent = useMemo(() => {
    if (instanceStops.length === 0) {
      const total = activeInstance?.StopsTotal ?? 0;
      const completed = activeInstance?.StopsCompleted ?? 0;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    }
    const done = instanceStops.filter((s) => s.Status === RouteStopStatus.Completed || s.Status === RouteStopStatus.Skipped).length;
    return Math.round((done / instanceStops.length) * 100);
  }, [instanceStops, activeInstance]);

  const routeGeoJSON = useMemo(() => {
    // Prefer directions geometry, fall back to instance actual route geometry
    if (directions?.Geometry) {
      return parseRouteGeometry(directions.Geometry);
    }
    if (activeInstance?.ActualRouteGeometry) {
      return parseRouteGeometry(activeInstance.ActualRouteGeometry);
    }
    return null;
  }, [directions?.Geometry, activeInstance?.ActualRouteGeometry]);

  const geofenceGeoJSON = useMemo(() => {
    if (!currentStop) return null;
    if (!currentStop.Longitude || !currentStop.Latitude || !isFinite(currentStop.Longitude) || !isFinite(currentStop.Latitude)) return null;
    const radius = currentStop.GeofenceRadiusMeters || 100;
    return buildGeofenceCircle(currentStop.Longitude, currentStop.Latitude, radius);
  }, [currentStop]);

  // --- Initial data fetch ---
  useEffect(() => {
    if (!resolvedInstanceId) return;
    fetchRouteProgress(resolvedInstanceId);
    fetchStopsForInstance(resolvedInstanceId);
    fetchDirections(resolvedInstanceId);
    fetchDeviations();
  }, [resolvedInstanceId, fetchRouteProgress, fetchStopsForInstance, fetchDirections, fetchDeviations]);

  // --- Polling for progress ---
  useEffect(() => {
    if (!resolvedInstanceId) return;
    const interval = setInterval(() => {
      fetchRouteProgress(resolvedInstanceId);
      fetchStopsForInstance(resolvedInstanceId);
      fetchDeviations();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [resolvedInstanceId, fetchRouteProgress, fetchStopsForInstance, fetchDeviations]);

  // --- Center on user location as soon as map is ready ---
  useEffect(() => {
    if (!isMapReady || !cameraRef.current) return;
    if (latitude != null && longitude != null) {
      cameraRef.current.flyTo([longitude, latitude], 500);
    }
  }, [isMapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fit bounds to stops + user location once stops are loaded ---
  useEffect(() => {
    if (!isMapReady || instanceStops.length === 0 || !cameraRef.current) return;

    const validStops = instanceStops.filter((s) => s.Latitude != null && s.Longitude != null && isFinite(s.Latitude) && isFinite(s.Longitude));
    if (validStops.length === 0) return;

    const lngs = validStops.map((s) => s.Longitude);
    const lats = validStops.map((s) => s.Latitude);

    if (latitude != null && longitude != null && isFinite(latitude) && isFinite(longitude)) {
      lngs.push(longitude);
      lats.push(latitude);
    }

    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];

    cameraRef.current.fitBounds(ne, sw, [60, 60, 60, 60], 800);
  }, [isMapReady, instanceStops]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Actions ---
  const handleCheckIn = useCallback(() => {
    if (!currentStop || !activeUnitId) return;
    checkIn(currentStop.RouteInstanceStopId, activeUnitId, latitude ?? 0, longitude ?? 0);
  }, [currentStop, activeUnitId, latitude, longitude, checkIn]);

  const handleCheckOut = useCallback(() => {
    if (!currentStop || !activeUnitId) return;
    checkOut(currentStop.RouteInstanceStopId, activeUnitId);
  }, [currentStop, activeUnitId, checkOut]);

  const handleSkip = useCallback(() => {
    if (!currentStop) return;
    setSkipReason('');
    setSkipModalVisible(true);
  }, [currentStop]);

  const handleSkipConfirm = useCallback(() => {
    if (!currentStop) return;
    setSkipModalVisible(false);
    skip(currentStop.RouteInstanceStopId, skipReason.trim() || t('routes.skipped_by_driver'));
  }, [currentStop, skipReason, skip, t]);

  const handleEndRoute = useCallback(() => {
    if (!resolvedInstanceId) return;
    Alert.alert(t('routes.end_route'), t('routes.end_route_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('routes.end_route'),
        style: 'destructive',
        onPress: async () => {
          try {
            await endRouteInstance(resolvedInstanceId);
            router.back();
          } catch {
            Alert.alert(t('common.error'), t('common.errorOccurred'));
          }
        },
      },
    ]);
  }, [resolvedInstanceId, endRouteInstance, router, t]);

  const handleDirections = useCallback(() => {
    if (!resolvedInstanceId) return;
    router.push(`/routes/directions?instanceId=${resolvedInstanceId}`);
  }, [resolvedInstanceId, router]);

  const handleDeviationPress = useCallback(() => {
    // Could navigate to a deviations detail screen in the future
  }, []);

  return (
    <Box className="flex-1 bg-white dark:bg-gray-900">
      {/* Map area - 60% height */}
      <Box className="h-[60%]">
        <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} onDidFinishLoadingMap={() => setIsMapReady(true)}>
          <Mapbox.Camera ref={cameraRef} />

          {/* Route polyline */}
          {routeGeoJSON ? (
            <Mapbox.ShapeSource id="route-line" shape={routeGeoJSON}>
              <Mapbox.LineLayer
                id="route-line-layer"
                style={{
                  lineColor: routeColor,
                  lineWidth: 4,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {/* Geofence circle around next pending stop */}
          {geofenceGeoJSON ? (
            <Mapbox.ShapeSource id="geofence-circle" shape={geofenceGeoJSON}>
              <Mapbox.FillLayer
                id="geofence-fill"
                style={{
                  fillColor: routeColor,
                  fillOpacity: 0.1,
                }}
              />
              <Mapbox.LineLayer
                id="geofence-border"
                style={{
                  lineColor: routeColor,
                  lineWidth: 2,
                  lineDasharray: [2, 2],
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {/* Stop markers */}
          {instanceStops
            .filter((s) => s.Latitude != null && s.Longitude != null && isFinite(s.Latitude) && isFinite(s.Longitude))
            .map((stop) => (
              <Mapbox.PointAnnotation key={stop.RouteInstanceStopId} id={`stop-${stop.RouteInstanceStopId}`} coordinate={[stop.Longitude, stop.Latitude]}>
                <StopMarker stopOrder={stop.StopOrder} status={stop.Status} />
              </Mapbox.PointAnnotation>
            ))}
        </Mapbox.MapView>

        {/* Map overlay buttons */}
        <Box className="absolute right-3 top-14">
          <VStack space="sm">
            <Button size="sm" className="rounded-full bg-white shadow-md dark:bg-gray-800" onPress={handleDirections}>
              <Icon as={Navigation} size="sm" className="text-blue-600" />
            </Button>
            <Button size="sm" className="rounded-full bg-white shadow-md dark:bg-gray-800" onPress={handleEndRoute}>
              <Icon as={LogOut} size="sm" className="text-red-500" />
            </Button>
          </VStack>
        </Box>

        {/* Progress indicator */}
        {activeInstance ? (
          <Box className="absolute bottom-2 left-3 rounded-lg bg-white/90 px-3 py-1.5 shadow-sm dark:bg-gray-800/90">
            <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {progressPercent}% {t('routes.completed')}
            </Text>
          </Box>
        ) : null}
      </Box>

      {/* Bottom area */}
      <Box className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Deviation banner */}
          {deviations.length > 0 ? (
            <Box className="mt-2">
              <RouteDeviationBanner deviations={deviations} onPress={handleDeviationPress} onDismiss={ackDeviation} />
            </Box>
          ) : null}

          {/* Current stop card */}
          {currentStop ? (
            <Box className="px-4 pt-3">
              <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('routes.current_step')}</Text>
              <StopCard stop={currentStop} isCurrent onCheckIn={handleCheckIn} onCheckOut={handleCheckOut} onSkip={handleSkip} />
            </Box>
          ) : (
            <Box className="px-4 pt-3">
              <Text className="text-center text-sm text-gray-500 dark:text-gray-400">{t('routes.stops_completed')}</Text>
            </Box>
          )}

          {/* ETA to next stop */}
          {activeInstance?.EtaToNextStop ? (
            <Box className="mx-4 mb-2">
              <HStack className="items-center space-x-1">
                <Icon as={Compass} size="xs" className="text-gray-400" />
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {t('routes.eta_to_next')}: {activeInstance.EtaToNextStop}
                </Text>
              </HStack>
            </Box>
          ) : null}

          {/* Directions button */}
          <Box className="mx-4 mb-3">
            <Button size="sm" variant="outline" className="border-blue-500" onPress={handleDirections}>
              <Icon as={Navigation} size="xs" className="mr-1 text-blue-600" />
              <ButtonText className="text-blue-600">{t('routes.directions')}</ButtonText>
            </Button>
          </Box>

          {/* Stop list */}
          <Box className="px-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('routes.stops')}</Text>
            {instanceStops.map((stop) => (
              <StopCard
                key={stop.RouteInstanceStopId}
                stop={stop}
                isCurrent={stop.RouteInstanceStopId === currentStop?.RouteInstanceStopId}
                onCheckIn={stop.RouteInstanceStopId === currentStop?.RouteInstanceStopId ? handleCheckIn : undefined}
                onCheckOut={stop.RouteInstanceStopId === currentStop?.RouteInstanceStopId ? handleCheckOut : undefined}
                onSkip={stop.RouteInstanceStopId === currentStop?.RouteInstanceStopId ? handleSkip : undefined}
              />
            ))}
          </Box>

          {/* End Route button */}
          <Box className="mx-4 mt-4">
            <Button className="bg-red-500" onPress={handleEndRoute}>
              <Icon as={LogOut} size="sm" className="mr-2 text-white" />
              <ButtonText>{t('routes.end_route')}</ButtonText>
            </Button>
          </Box>
        </ScrollView>
      </Box>

      {/* Skip reason modal */}
      <Modal visible={skipModalVisible} transparent animationType="fade" onRequestClose={() => setSkipModalVisible(false)}>
        <Box className="flex-1 items-center justify-center bg-black/50 px-6">
          <Box className="w-full rounded-2xl bg-white p-6 dark:bg-gray-800">
            <Text className="mb-1 text-base font-semibold text-gray-900 dark:text-white">
              {t('routes.skip')} — {currentStop?.Name}
            </Text>
            <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t('routes.skip_reason')}</Text>
            <TextInput value={skipReason} onChangeText={setSkipReason} placeholder={t('routes.skip_reason_placeholder')} placeholderTextColor="#9ca3af" multiline numberOfLines={3} style={styles.skipInput} autoFocus />
            <HStack className="mt-4 gap-3">
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSkipModalVisible(false)}>
                <Text className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkipConfirm}>
                <Text className="text-center text-sm font-semibold text-white">{t('routes.skip')}</Text>
              </TouchableOpacity>
            </HStack>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  skipInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#eab308',
    alignItems: 'center',
  },
});
