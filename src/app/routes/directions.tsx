import { useLocalSearchParams } from 'expo-router';
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon, ExternalLinkIcon, FlagIcon, MapIcon, MapPinIcon, NavigationIcon, PlayIcon, TimerIcon, TrafficConeIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import { Camera, LineLayer, MapView, PointAnnotation, ShapeSource, StyleURL, UserLocation } from '@/components/maps/mapbox';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { Env } from '@/lib/env';
import { RouteStopStatus } from '@/models/v4/routes/routeInstanceStopResultData';
import { useRoutesStore } from '@/stores/routes/store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAPBOX_DIRECTIONS_API = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
const MAPBOX_GEOCODING_API = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

const DRIVING_PROFILE = 'driving-traffic'; // uses traffic-aware routing

const statusColor: Record<number, string> = {
  [RouteStopStatus.Pending]: '#9ca3af',
  [RouteStopStatus.InProgress]: '#3b82f6',
  [RouteStopStatus.Completed]: '#22c55e',
  [RouteStopStatus.Skipped]: '#eab308',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DirectionsSegment {
  /** GeoJSON LineString coordinates for this segment */
  coordinates: [number, number][];
  /** Distance in meters */
  distance: number;
  /** Duration in seconds (with traffic) */
  duration: number;
  /** Typical duration without traffic */
  durationTypical?: number;
}

interface RouteDirectionsInfo {
  totalDistance: number;
  totalDuration: number;
  totalDurationTypical: number;
  segments: DirectionsSegment[];
  /** Concatenated GeoJSON for rendering */
  routeGeoJSON: GeoJSON.Feature;
  /** Congestion segments extracted from Mapbox response */
  congestion: CongestionSegment[];
}

interface CongestionSegment {
  coordinate: [number, number];
  level: 'low' | 'moderate' | 'heavy' | 'severe';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Map congestion level string from the Mapbox API to a color */
const congestionColor = (level: string): string => {
  switch (level) {
    case 'low':
      return '#22c55e'; // green
    case 'moderate':
      return '#eab308'; // yellow
    case 'heavy':
      return '#f97316'; // orange
    case 'severe':
      return '#ef4444'; // red
    default:
      return '#3b82f6'; // blue (unknown / no data)
  }
};

/** Derive a human-readable driving condition summary from congestion data */
const deriveDrivingCondition = (congestion: CongestionSegment[]): { label: string; color: string; icon: typeof TrafficConeIcon } => {
  if (congestion.length === 0) {
    return { label: 'No traffic data', color: '#9ca3af', icon: TrafficConeIcon };
  }

  const counts = { low: 0, moderate: 0, heavy: 0, severe: 0 };
  for (const seg of congestion) {
    counts[seg.level]++;
  }
  const total = congestion.length;

  if (counts.severe / total > 0.15) {
    return { label: 'Severe traffic', color: '#ef4444', icon: AlertTriangleIcon };
  }
  if (counts.heavy / total > 0.2) {
    return { label: 'Heavy traffic', color: '#f97316', icon: AlertTriangleIcon };
  }
  if (counts.moderate / total > 0.3) {
    return { label: 'Moderate traffic', color: '#eab308', icon: TrafficConeIcon };
  }
  return { label: 'Light traffic', color: '#22c55e', icon: TrafficConeIcon };
};

// ---------------------------------------------------------------------------
// Mapbox Directions API fetcher
// ---------------------------------------------------------------------------

/**
 * Fetches driving directions from the Mapbox Directions API for a set of
 * coordinate waypoints (stop locations). Requests traffic-aware durations
 * and congestion annotations.
 *
 * Returns parsed route geometry, durations, and congestion data, or null
 * on failure (e.g., missing API key, network error).
 */
async function fetchMapboxDirections(waypoints: [number, number][]): Promise<RouteDirectionsInfo | null> {
  if (waypoints.length < 2) return null;

  const token = Env.UNIT_MAPBOX_PUBKEY;
  if (!token) return null;

  // Build the coordinate string for Mapbox Directions API
  // Format: lng1,lat1;lng2,lat2;...
  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');

  const url =
    `${MAPBOX_DIRECTIONS_API}/${coords}` + `?access_token=${token}` + `&geometries=geojson` + `&overview=full` + `&annotations=congestion,duration,distance` + `&steps=true` + `&continue_straight=true` + `&language=en`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];

    // Extract geometry coordinates
    const routeCoords: [number, number][] = route.geometry?.coordinates ?? [];

    // Extract leg-level distance/duration
    const segments: DirectionsSegment[] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let totalDurationTypical = 0;

    for (const leg of route.legs ?? []) {
      const legDistance: number = leg.distance ?? 0;
      const legDuration: number = leg.duration ?? 0;
      // Mapbox doesn't always return duration_typical, use duration as fallback
      const legDurationTypical: number = leg.duration_typical ?? legDuration;

      totalDistance += legDistance;
      totalDuration += legDuration;
      totalDurationTypical += legDurationTypical;

      // Collect congestion annotations from the leg's annotation
      const annotationCongestion: string[] = leg.annotation?.congestion ?? [];

      // Extract coordinates for this leg's segment from step geometries
      let segmentCoords: [number, number][] = [];
      for (const step of leg.steps ?? []) {
        const stepCoords = step.geometry?.coordinates ?? [];
        segmentCoords = segmentCoords.concat(stepCoords);
      }

      segments.push({
        coordinates: segmentCoords.length > 0 ? segmentCoords : [],
        distance: legDistance,
        duration: legDuration,
        durationTypical: legDurationTypical,
      });
    }

    // Build congestion segments from the annotation
    const congestion: CongestionSegment[] = [];
    if (route.legs) {
      for (const leg of route.legs) {
        const annotationCongestion: string[] = leg.annotation?.congestion ?? [];
        // Each annotation entry corresponds to a coordinate pair between nodes
        // We sample along the leg to build congestion segments
        const legCoords: [number, number][] = [];
        for (const step of leg.steps ?? []) {
          const stepCoords = step.geometry?.coordinates ?? [];
          legCoords.push(...stepCoords);
        }
        // Map congestion annotations to coordinates (one per edge)
        const edgesCount = Math.min(annotationCongestion.length, legCoords.length - 1);
        for (let i = 0; i < edgesCount; i++) {
          const level = annotationCongestion[i];
          if (level && level !== 'unknown') {
            congestion.push({
              coordinate: legCoords[i],
              level: level as CongestionSegment['level'],
            });
          }
        }
      }
    }

    // Build GeoJSON Feature from the full route geometry
    const routeGeoJSON: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoords,
      },
    };

    return {
      totalDistance,
      totalDuration,
      totalDurationTypical,
      segments,
      routeGeoJSON,
      congestion,
    };
  } catch {
    return null;
  }
}

/**
 * Build a fallback straight-line GeoJSON from stops when directions API is unavailable.
 */
function buildFallbackRoute(stops: { Longitude: number; Latitude: number; StopOrder: number }[]): GeoJSON.Feature {
  const sorted = [...stops].sort((a, b) => a.StopOrder - b.StopOrder);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: sorted.map((s) => [s.Longitude, s.Latitude] as [number, number]),
    },
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Start marker: green with play icon label */
function StartMarker({ name }: { name: string }) {
  return (
    <View style={markerStyles.container}>
      <View style={[markerStyles.pin, { backgroundColor: '#22c55e' }]}>
        <PlayIcon size={14} color="#ffffff" />
      </View>
      <View style={markerStyles.labelContainer}>
        <RNText style={markerStyles.labelText} numberOfLines={1}>
          {name}
        </RNText>
      </View>
    </View>
  );
}

/** End marker: red with flag icon label */
function EndMarker({ name }: { name: string }) {
  return (
    <View style={markerStyles.container}>
      <View style={[markerStyles.pin, { backgroundColor: '#ef4444' }]}>
        <FlagIcon size={14} color="#ffffff" />
      </View>
      <View style={markerStyles.labelContainer}>
        <RNText style={markerStyles.labelText} numberOfLines={1}>
          {name}
        </RNText>
      </View>
    </View>
  );
}

/** Intermediate stop marker: numbered circle */
function IntermediateStopMarker({ order, color }: { order: number; color: string }) {
  return (
    <View style={markerStyles.container}>
      <View style={[markerStyles.circle, { backgroundColor: color }]}>
        <RNText style={markerStyles.circleText}>{order}</RNText>
      </View>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  circleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  labelContainer: {
    marginTop: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 120,
  },
  labelText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function RouteDirectionsScreen() {
  const { t } = useTranslation();
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const { colorScheme } = useColorScheme();
  const cameraRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFetchingDirections, setIsFetchingDirections] = useState(false);
  const [mapboxDirections, setMapboxDirections] = useState<RouteDirectionsInfo | null>(null);

  const directions = useRoutesStore((s) => s.directions);
  const isLoadingDirections = useRoutesStore((s) => s.isLoadingDirections);
  const error = useRoutesStore((s) => s.error);
  const fetchDirections = useRoutesStore((s) => s.fetchDirections);
  const activeInstance = useRoutesStore((s) => s.activeInstance);
  const instanceStops = useRoutesStore((s) => s.instanceStops);
  const fetchStopsForInstance = useRoutesStore((s) => s.fetchStopsForInstance);

  const resolvedInstanceId = (() => {
    const id = instanceId && instanceId !== 'undefined' ? instanceId : activeInstance?.RouteInstanceId;
    return id || undefined;
  })();

  // Fetch backend directions and stops
  useEffect(() => {
    if (resolvedInstanceId) {
      fetchDirections(resolvedInstanceId);
      fetchStopsForInstance(resolvedInstanceId);
    }
  }, [resolvedInstanceId, fetchDirections, fetchStopsForInstance]);

  // Sorted stops for display
  const sortedStops = useMemo(() => [...instanceStops].sort((a, b) => a.StopOrder - b.StopOrder), [instanceStops]);

  // Valid stops with coordinates
  const validStops = useMemo(() => sortedStops.filter((s) => s.Latitude != null && s.Longitude != null && isFinite(s.Latitude) && isFinite(s.Longitude)), [sortedStops]);

  // First and last stops for distinct markers
  const startStop = validStops.length > 0 ? validStops[0] : null;
  const endStop = validStops.length > 1 ? validStops[validStops.length - 1] : null;

  // Intermediate stops (everything except first and last)
  const intermediateStops = useMemo(() => {
    if (validStops.length <= 2) return [];
    return validStops.slice(1, -1);
  }, [validStops]);

  // Fetch real driving directions from Mapbox API
  useEffect(() => {
    if (validStops.length < 2) return;

    let cancelled = false;

    const fetchDrivingDirections = async () => {
      setIsFetchingDirections(true);
      const waypoints: [number, number][] = validStops.map((s) => [s.Longitude, s.Latitude]);

      const result = await fetchMapboxDirections(waypoints);

      if (!cancelled) {
        setMapboxDirections(result);
        setIsFetchingDirections(false);
      }
    };

    fetchDrivingDirections();

    return () => {
      cancelled = true;
    };
  }, [validStops]);

  // Build the route GeoJSON: prefer Mapbox directions, fallback to backend, then straight-line
  const routeGeoJson = useMemo((): GeoJSON.Feature | null => {
    // 1. Best: Mapbox driving directions with real road geometry
    if (mapboxDirections?.routeGeoJSON) {
      return mapboxDirections.routeGeoJSON;
    }

    // 2. Server-side directions geometry
    if (directions?.Geometry) {
      try {
        const parsed = JSON.parse(directions.Geometry);
        return parsed;
      } catch {
        // fall through
      }
    }

    // 3. Fallback: straight-line connections between stops
    if (validStops.length >= 2) {
      return buildFallbackRoute(validStops);
    }

    return null;
  }, [mapboxDirections, directions, validStops]);

  // Congestion overlay GeoJSON: colored line segments by traffic level
  const congestionGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!mapboxDirections || mapboxDirections.congestion.length === 0) return null;

    // Group consecutive congestion points into features
    const features: GeoJSON.Feature[] = [];
    let currentLevel: string | null = null;
    let currentCoords: [number, number][] = [];

    for (const seg of mapboxDirections.congestion) {
      if (seg.level !== currentLevel) {
        if (currentCoords.length >= 2 && currentLevel) {
          features.push({
            type: 'Feature',
            properties: { level: currentLevel, color: congestionColor(currentLevel) },
            geometry: { type: 'LineString', coordinates: currentCoords },
          });
        }
        currentLevel = seg.level;
        currentCoords = [seg.coordinate];
      } else {
        currentCoords.push(seg.coordinate);
      }
    }

    // Flush last segment
    if (currentCoords.length >= 2 && currentLevel) {
      features.push({
        type: 'Feature',
        properties: { level: currentLevel, color: congestionColor(currentLevel) },
        geometry: { type: 'LineString', coordinates: currentCoords },
      });
    }

    if (features.length === 0) return null;

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [mapboxDirections]);

  // Distance: prefer Mapbox directions (more accurate), fallback to server
  const estimatedDistance = useMemo(() => {
    if (mapboxDirections?.totalDistance != null && mapboxDirections.totalDistance > 0) {
      return mapboxDirections.totalDistance;
    }
    return directions?.EstimatedDistanceMeters ?? null;
  }, [mapboxDirections, directions]);

  // Duration: prefer Mapbox directions (traffic-aware), fallback to server
  const estimatedDuration = useMemo(() => {
    if (mapboxDirections?.totalDuration != null && mapboxDirections.totalDuration > 0) {
      return mapboxDirections.totalDuration;
    }
    return directions?.EstimatedDurationSeconds ?? null;
  }, [mapboxDirections, directions]);

  // Typical duration (without traffic) — for comparison
  const typicalDuration = useMemo(() => {
    if (mapboxDirections?.totalDurationTypical != null && mapboxDirections.totalDurationTypical > 0) {
      return mapboxDirections.totalDurationTypical;
    }
    return null;
  }, [mapboxDirections]);

  // Traffic delay
  const trafficDelaySeconds = useMemo(() => {
    if (estimatedDuration != null && typicalDuration != null && typicalDuration > 0) {
      const delay = estimatedDuration - typicalDuration;
      return delay > 30 ? delay : 0; // only show meaningful delays (>30s)
    }
    return null;
  }, [estimatedDuration, typicalDuration]);

  // Driving conditions summary
  const drivingCondition = useMemo(() => {
    if (mapboxDirections?.congestion) {
      return deriveDrivingCondition(mapboxDirections.congestion);
    }
    return null;
  }, [mapboxDirections]);

  // ETA (arrival time)
  const eta = useMemo(() => {
    if (estimatedDuration == null) return null;
    const arrivalTime = new Date(Date.now() + estimatedDuration * 1000);
    return arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [estimatedDuration]);

  // Destination for "Open in Maps"
  const destination = useMemo(() => {
    const last = sortedStops[sortedStops.length - 1];
    if (last?.Latitude != null && last?.Longitude != null) {
      return { lat: last.Latitude, lon: last.Longitude, name: last.Name };
    }
    return null;
  }, [sortedStops]);

  // ---------------------------------------------------------------------------
  // Camera: imperative fitBounds matching the active route screen pattern
  // ---------------------------------------------------------------------------

  // Once the map is ready AND stops are loaded, fit bounds to show all stops.
  // If Mapbox driving directions are later loaded, re-fit to the full route.
  useEffect(() => {
    if (!isMapReady || validStops.length === 0 || !cameraRef.current) return;

    let lngs = validStops.map((s) => s.Longitude);
    let lats = validStops.map((s) => s.Latitude);

    // Prefer fitting to full driving route geometry when available
    if (mapboxDirections?.routeGeoJSON) {
      const geom = mapboxDirections.routeGeoJSON.geometry as GeoJSON.LineString;
      if (geom?.coordinates && geom.coordinates.length > 1) {
        lngs = geom.coordinates.map((c: number[]) => c[0]);
        lats = geom.coordinates.map((c: number[]) => c[1]);
      }
    }

    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];

    // Padding: [top, right, bottom, left] — extra bottom for the overlay panel
    cameraRef.current.fitBounds(ne, sw, [60, 60, 300, 60], 800);
  }, [isMapReady, validStops, mapboxDirections]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenInMaps = useCallback(() => {
    if (destination) {
      openInMaps(destination.lat, destination.lon, destination.name ?? t('routes.destination'));
    }
  }, [destination, t]);

  // --- Loading states ---
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
        <Text className="mt-4 text-center text-typography-500">{error ?? t('routes.no_directions')}</Text>
      </Box>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView style={styles.map} styleURL={colorScheme === 'dark' ? StyleURL.Dark : StyleURL.Street} onDidFinishLoadingMap={() => setIsMapReady(true)}>
          <UserLocation visible={true} />
          {/* Bare Camera — positioned imperatively via fitBounds once isMapReady && validStops */}
          <Camera ref={cameraRef} />
          {/* Route line (driving geometry) */}
          {routeGeoJson ? (
            <ShapeSource id="routeSource" shape={routeGeoJson}>
              {/* Shadow/border line underneath */}
              <LineLayer
                id="routeLineShadow"
                belowLayerID="routeLine"
                style={{
                  lineColor: '#1e3a5f',
                  lineWidth: 7,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.4,
                }}
              />
              {/* Main route line */}
              <LineLayer
                id="routeLine"
                style={{
                  lineColor: '#3b82f6',
                  lineWidth: 5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          ) : null}

          {/* Congestion overlay */}
          {congestionGeoJSON ? (
            <ShapeSource id="congestionSource" shape={congestionGeoJSON}>
              <LineLayer
                id="congestionLine"
                style={{
                  lineColor: ['get', 'color'],
                  lineWidth: 5,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.8,
                }}
              />
            </ShapeSource>
          ) : null}

          {/* Start marker */}
          {startStop ? (
            <PointAnnotation id="start-stop" coordinate={[startStop.Longitude, startStop.Latitude]}>
              <StartMarker name={startStop.Name} />
            </PointAnnotation>
          ) : null}

          {/* End marker (only if different from start) */}
          {endStop && endStop.RouteInstanceStopId !== startStop?.RouteInstanceStopId ? (
            <PointAnnotation id="end-stop" coordinate={[endStop.Longitude, endStop.Latitude]}>
              <EndMarker name={endStop.Name} />
            </PointAnnotation>
          ) : null}

          {/* Intermediate stop markers */}
          {intermediateStops.map((stop) => (
            <PointAnnotation key={stop.RouteInstanceStopId} id={`dir-stop-${stop.RouteInstanceStopId}`} coordinate={[stop.Longitude, stop.Latitude]}>
              <IntermediateStopMarker order={stop.StopOrder} color={statusColor[stop.Status] ?? '#9ca3af'} />
            </PointAnnotation>
          ))}
        </MapView>

        {/* Loading overlay while fetching driving directions */}
        {isFetchingDirections ? (
          <View style={styles.fetchingOverlay}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text className="ml-2 text-xs text-typography-500">{t('routes.fetching_directions')}</Text>
          </View>
        ) : null}
      </View>

      {/* Bottom panel */}
      <Box className={`absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-lg ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`} style={{ maxHeight: '55%' }}>
        {/* Summary bar: distance, duration, ETA, driving conditions */}
        <Box className={`border-b px-4 py-3 ${colorScheme === 'dark' ? 'border-neutral-700' : 'border-outline-100'}`}>
          <HStack className="items-center justify-between">
            {/* Distance */}
            {estimatedDistance != null ? (
              <VStack className="items-center">
                <HStack className="items-center gap-1">
                  <NavigationIcon size={12} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
                  <Text className="text-xs font-semibold text-typography-600">{formatDistance(estimatedDistance)}</Text>
                </HStack>
                <Text className="text-[10px] text-typography-400">{t('routes.distance')}</Text>
              </VStack>
            ) : null}

            {/* Duration with traffic */}
            {estimatedDuration != null ? (
              <VStack className="items-center">
                <HStack className="items-center gap-1">
                  <TimerIcon size={12} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
                  <Text className="text-xs font-semibold text-typography-600">{formatDuration(estimatedDuration)}</Text>
                </HStack>
                <Text className="text-[10px] text-typography-400">{t('routes.duration')}</Text>
              </VStack>
            ) : null}

            {/* ETA */}
            {eta ? (
              <VStack className="items-center">
                <HStack className="items-center gap-1">
                  <ClockIcon size={12} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
                  <Text className="text-xs font-semibold text-typography-600">{eta}</Text>
                </HStack>
                <Text className="text-[10px] text-typography-400">{t('routes.eta')}</Text>
              </VStack>
            ) : null}

            {/* Driving conditions */}
            {drivingCondition ? (
              <VStack className="items-center">
                <HStack className="items-center gap-1">
                  <TrafficConeIcon size={12} color={drivingCondition.color} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: drivingCondition.color }}>{drivingCondition.label}</Text>
                </HStack>
                {trafficDelaySeconds != null && trafficDelaySeconds > 0 ? (
                  <Text className="text-[10px] text-typography-400">
                    +{formatDuration(trafficDelaySeconds)} {t('routes.delay')}
                  </Text>
                ) : (
                  <Text className="text-[10px] text-typography-400">{t('routes.driving_conditions')}</Text>
                )}
              </VStack>
            ) : null}
          </HStack>

          {/* Traffic delay bar — only when there's a notable delay */}
          {trafficDelaySeconds != null && trafficDelaySeconds > 60 ? (
            <HStack className="mt-2 items-center justify-center gap-1 rounded-md bg-amber-50 px-2 py-1 dark:bg-amber-900/20">
              <AlertTriangleIcon size={12} color="#f59e0b" />
              <Text className="text-xs text-amber-700 dark:text-amber-300">{t('routes.traffic_delay', { time: formatDuration(trafficDelaySeconds) })}</Text>
            </HStack>
          ) : null}
        </Box>

        {/* Stops list */}
        <ScrollView style={{ maxHeight: 240 }}>
          {sortedStops.map((stop, index) => {
            const color = statusColor[stop.Status] ?? '#9ca3af';
            const isLast = index === sortedStops.length - 1;
            const isFirst = index === 0;
            const isStopLast = isLast && sortedStops.length > 1;
            const stopLabel = isFirst ? t('routes.start') : isStopLast ? t('routes.end') : `#${stop.StopOrder}`;

            return (
              <HStack key={stop.RouteInstanceStopId} className={`items-start px-4 py-3 ${!isLast ? (colorScheme === 'dark' ? 'border-b border-neutral-700' : 'border-b border-neutral-100') : ''}`}>
                {/* Order badge with distinct styling for start/end */}
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isFirst ? '#22c55e20' : isStopLast ? '#ef444420' : color + '25',
                      borderColor: isFirst ? '#22c55e' : isStopLast ? '#ef4444' : 'transparent',
                      borderWidth: isFirst || isStopLast ? 1.5 : 0,
                    },
                  ]}
                >
                  {isFirst ? <PlayIcon size={10} color="#22c55e" /> : isStopLast ? <FlagIcon size={10} color="#ef4444" /> : <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{stop.StopOrder}</Text>}
                </View>

                <VStack className="ml-3 flex-1">
                  <HStack className="items-center gap-1">
                    <Text className="text-sm font-semibold">{stop.Name}</Text>
                    {isFirst ? (
                      <View style={{ backgroundColor: '#22c55e20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700' }}>{t('routes.start').toUpperCase()}</Text>
                      </View>
                    ) : null}
                    {isStopLast ? (
                      <View style={{ backgroundColor: '#ef444420', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '700' }}>{t('routes.end').toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </HStack>
                  {stop.Address ? (
                    <HStack className="mt-0.5 items-center gap-1">
                      <MapPinIcon size={11} color="#9ca3af" />
                      <Text className="text-xs text-typography-500" numberOfLines={1}>
                        {stop.Address}
                      </Text>
                    </HStack>
                  ) : null}
                  {/* Segment distance/duration from Mapbox if available */}
                  {mapboxDirections?.segments[index] ? (
                    <HStack className="mt-0.5 items-center gap-2">
                      <Text className="text-[10px] text-typography-400">
                        {formatDistance(mapboxDirections.segments[index].distance)} &middot; {formatDuration(mapboxDirections.segments[index].duration)}
                      </Text>
                    </HStack>
                  ) : null}
                </VStack>
                <HStack className="items-center gap-1">
                  {stop.Status === RouteStopStatus.Completed ? <CheckCircleIcon size={16} color="#22c55e" /> : stop.Status === RouteStopStatus.InProgress ? <ClockIcon size={16} color="#3b82f6" /> : null}
                </HStack>
              </HStack>
            );
          })}
        </ScrollView>

        {/* Actions */}
        <HStack className="gap-3 px-4 pb-6 pt-3">
          <Button className="flex-1" variant="outline" size="sm" onPress={handleOpenInMaps} disabled={!destination}>
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
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  fetchingOverlay: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 6,
    marginHorizontal: 60,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
