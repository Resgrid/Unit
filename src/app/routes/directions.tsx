import { useLocalSearchParams } from 'expo-router';
import {
  CheckCircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  MapIcon,
  MapPinIcon,
  NavigationIcon,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  Camera,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  StyleURL,
  UserLocation,
} from '@/components/maps/mapbox';
import { Loading } from '@/components/common/loading';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRoutesStore } from '@/stores/routes/store';
import { RouteStopStatus } from '@/models/v4/routes/routeInstanceStopResultData';

const openInMaps = (lat: number, lon: number, label: string) => {
  const url = Platform.select({
    ios: `maps://app?daddr=${lat},${lon}&q=${encodeURIComponent(label)}`,
    android: `google.navigation:q=${lat},${lon}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
  });
  if (url) Linking.openURL(url);
};

const formatDistance = (meters: number | null | undefined): string => {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds == null) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
};

const statusColor: Record<number, string> = {
  [RouteStopStatus.Pending]: '#9ca3af',
  [RouteStopStatus.InProgress]: '#3b82f6',
  [RouteStopStatus.Completed]: '#22c55e',
  [RouteStopStatus.Skipped]: '#eab308',
};

export default function RouteDirectionsScreen() {
  const { t } = useTranslation();
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const { colorScheme } = useColorScheme();
  const cameraRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const directions = useRoutesStore((s) => s.directions);
  const isLoadingDirections = useRoutesStore((s) => s.isLoadingDirections);
  const error = useRoutesStore((s) => s.error);
  const fetchDirections = useRoutesStore((s) => s.fetchDirections);
  const activeInstance = useRoutesStore((s) => s.activeInstance);
  const instanceStops = useRoutesStore((s) => s.instanceStops);

  const resolvedInstanceId = (() => {
    const id = (instanceId && instanceId !== 'undefined') ? instanceId : activeInstance?.RouteInstanceId;
    return id || undefined;
  })();

  useEffect(() => {
    if (resolvedInstanceId) {
      fetchDirections(resolvedInstanceId);
    }
  }, [resolvedInstanceId, fetchDirections]);

  // Build route GeoJSON from Geometry field or stop coordinates
  const routeGeoJson = useMemo(() => {
    if (directions?.Geometry) {
      try {
        const parsed = JSON.parse(directions.Geometry);
        return parsed;
      } catch {
        // fall through
      }
    }
    const validStops = instanceStops.filter(
      (s) => s.Latitude != null && s.Longitude != null && isFinite(s.Latitude) && isFinite(s.Longitude)
    );
    if (validStops.length < 2) return null;
    const sorted = [...validStops].sort((a, b) => a.StopOrder - b.StopOrder);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: sorted.map((s) => [s.Longitude, s.Latitude]),
      },
      properties: {},
    };
  }, [directions, instanceStops]);

  // Sorted stops for display
  const sortedStops = useMemo(
    () => [...instanceStops].sort((a, b) => a.StopOrder - b.StopOrder),
    [instanceStops]
  );

  const destination = useMemo(() => {
    const last = sortedStops[sortedStops.length - 1];
    if (last?.Latitude != null && last?.Longitude != null) {
      return { lat: last.Latitude, lon: last.Longitude, name: last.Name };
    }
    return null;
  }, [sortedStops]);

  // Fit map to stops once ready
  useEffect(() => {
    if (!isMapReady || sortedStops.length === 0 || !cameraRef.current) return;
    const valid = sortedStops.filter(
      (s) => s.Latitude != null && s.Longitude != null && isFinite(s.Latitude) && isFinite(s.Longitude)
    );
    if (valid.length === 0) return;
    const lngs = valid.map((s) => s.Longitude);
    const lats = valid.map((s) => s.Latitude);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    cameraRef.current.fitBounds(ne, sw, [60, 60, 60, 60], 600);
  }, [isMapReady, sortedStops]);

  const handleOpenInMaps = useCallback(() => {
    if (destination) {
      openInMaps(destination.lat, destination.lon, destination.name ?? t('routes.destination'));
    }
  }, [destination, t]);

  if (isLoadingDirections && sortedStops.length === 0) {
    return (
      <View className="size-full flex-1">
        <Loading />
      </View>
    );
  }

  if (sortedStops.length === 0) {
    return (
      <Box className="flex-1 items-center justify-center p-4">
        <MapIcon size={48} color="#9ca3af" />
        <Text className="mt-4 text-center text-typography-500">
          {error ?? t('routes.no_directions')}
        </Text>
      </Box>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          styleURL={colorScheme === 'dark' ? StyleURL.Dark : StyleURL.Street}
          onDidFinishLoadingMap={() => setIsMapReady(true)}
        >
          <UserLocation visible={true} />
          <Camera ref={cameraRef} />

          {routeGeoJson && (
            <ShapeSource id="routeSource" shape={routeGeoJson}>
              <LineLayer
                id="routeLine"
                style={{
                  lineColor: '#3b82f6',
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          )}

          {sortedStops
            .filter((s) => s.Latitude != null && s.Longitude != null && isFinite(s.Latitude) && isFinite(s.Longitude))
            .map((stop) => (
              <PointAnnotation
                key={stop.RouteInstanceStopId}
                id={`dir-stop-${stop.RouteInstanceStopId}`}
                coordinate={[stop.Longitude, stop.Latitude]}
              >
                <View
                  style={[
                    styles.marker,
                    { backgroundColor: statusColor[stop.Status] ?? '#9ca3af' },
                  ]}
                />
              </PointAnnotation>
            ))}
        </MapView>
      </View>

      {/* Stop list panel */}
      <Box
        className={`absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-lg ${
          colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'
        }`}
        style={{ maxHeight: '50%' }}
      >
        {/* Summary */}
        {(directions?.EstimatedDistanceMeters || directions?.EstimatedDurationSeconds) ? (
          <HStack className="items-center justify-between border-b border-outline-100 px-4 py-2">
            {directions.EstimatedDistanceMeters ? (
              <Text className="text-xs text-typography-500">
                {formatDistance(directions.EstimatedDistanceMeters)}
              </Text>
            ) : null}
            {directions.EstimatedDurationSeconds ? (
              <Text className="text-xs text-typography-500">
                {formatDuration(directions.EstimatedDurationSeconds)}
              </Text>
            ) : null}
          </HStack>
        ) : null}

        {/* Stops */}
        <ScrollView style={{ maxHeight: 240 }}>
          {sortedStops.map((stop, index) => {
            const color = statusColor[stop.Status] ?? '#9ca3af';
            const isLast = index === sortedStops.length - 1;
            return (
              <HStack
                key={stop.RouteInstanceStopId}
                className={`items-start px-4 py-3 ${
                  !isLast
                    ? colorScheme === 'dark'
                      ? 'border-b border-neutral-700'
                      : 'border-b border-neutral-100'
                    : ''
                }`}
              >
                {/* Order badge */}
                <View style={[styles.badge, { backgroundColor: color + '25' }]}>
                  <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{stop.StopOrder}</Text>
                </View>
                <VStack className="ml-3 flex-1">
                  <Text className="text-sm font-semibold">{stop.Name}</Text>
                  {stop.Address ? (
                    <HStack className="mt-0.5 items-center gap-1">
                      <MapPinIcon size={11} color="#9ca3af" />
                      <Text className="text-xs text-typography-500" numberOfLines={1}>
                        {stop.Address}
                      </Text>
                    </HStack>
                  ) : null}
                </VStack>
                {stop.Status === RouteStopStatus.Completed ? (
                  <CheckCircleIcon size={16} color="#22c55e" />
                ) : stop.Status === RouteStopStatus.InProgress ? (
                  <ClockIcon size={16} color="#3b82f6" />
                ) : null}
              </HStack>
            );
          })}
        </ScrollView>

        {/* Actions */}
        <HStack className="gap-3 px-4 pb-6 pt-3">
          <Button
            className="flex-1"
            variant="outline"
            size="sm"
            onPress={handleOpenInMaps}
            disabled={!destination}
          >
            <ButtonIcon as={ExternalLinkIcon} className="mr-1" />
            <ButtonText>{t('routes.open_in_maps')}</ButtonText>
          </Button>
        </HStack>
      </Box>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
