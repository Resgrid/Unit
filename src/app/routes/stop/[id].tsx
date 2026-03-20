import { format } from 'date-fns';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  CheckCircleIcon,
  ClockIcon,
  LogInIcon,
  LogOutIcon,
  MapPinIcon,
  SkipForwardIcon,
  UserIcon,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  StyleURL,
} from '@/components/maps/mapbox';
import { Loading } from '@/components/common/loading';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useLocationStore } from '@/stores/app/location-store';
import { useRoutesStore } from '@/stores/routes/store';
import { RouteStopStatus } from '@/models/v4/routes/routeInstanceStopResultData';

const STOP_TYPE_LABELS: Record<number, string> = {
  0: 'Standard',
  1: 'Pickup',
  2: 'Dropoff',
  3: 'Service',
  4: 'Inspection',
};

const PRIORITY_CONFIG: Record<number, { label: string; action: 'error' | 'warning' | 'success' | 'info' | 'muted' }> = {
  0: { label: 'Normal', action: 'muted' },
  1: { label: 'Low', action: 'info' },
  2: { label: 'Medium', action: 'warning' },
  3: { label: 'High', action: 'error' },
  4: { label: 'Critical', action: 'error' },
};

const STATUS_LABELS: Record<number, string> = {
  [RouteStopStatus.Pending]: 'Pending',
  [RouteStopStatus.InProgress]: 'In Progress',
  [RouteStopStatus.Completed]: 'Completed',
  [RouteStopStatus.Skipped]: 'Skipped',
};

/**
 * Build a GeoJSON circle polygon for the geofence overlay.
 */
const buildGeofenceGeoJson = (lat: number, lon: number, radiusMeters: number) => {
  const points = 64;
  const coords: number[][] = [];
  const earthRadius = 6371000;
  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dLat = (radiusMeters / earthRadius) * Math.cos(angle);
    const dLon =
      (radiusMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
};

export default function StopDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();

  const instanceStops = useRoutesStore((s) => s.instanceStops);
  const checkIn = useRoutesStore((s) => s.checkIn);
  const checkOut = useRoutesStore((s) => s.checkOut);
  const skip = useRoutesStore((s) => s.skip);
  const updateNotes = useRoutesStore((s) => s.updateNotes);
  const isLoadingStops = useRoutesStore((s) => s.isLoadingStops);

  const userLat = useLocationStore((s) => s.latitude);
  const userLon = useLocationStore((s) => s.longitude);

  const stop = useMemo(
    () => instanceStops.find((s) => s.RouteInstanceStopId === id) ?? null,
    [instanceStops, id]
  );

  const [notes, setNotes] = useState(stop?.Notes ?? '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (stop) {
      setNotes(stop.Notes ?? '');
    }
  }, [stop]);

  const geofenceGeoJson = useMemo(() => {
    if (!stop || !stop.Latitude || !stop.Longitude || !stop.GeofenceRadiusMeters) return null;
    return buildGeofenceGeoJson(stop.Latitude, stop.Longitude, stop.GeofenceRadiusMeters);
  }, [stop]);

  const priorityConfig = PRIORITY_CONFIG[stop?.Priority ?? 0] ?? PRIORITY_CONFIG[0];
  const stopTypeLabel = STOP_TYPE_LABELS[stop?.StopType ?? 0] ?? 'Unknown';
  const statusLabel = STATUS_LABELS[stop?.Status ?? 0] ?? 'Unknown';

  const handleSaveNotes = useCallback(async () => {
    if (!stop) return;
    setIsSavingNotes(true);
    try {
      await updateNotes(stop.RouteInstanceStopId, notes);
    } finally {
      setIsSavingNotes(false);
    }
  }, [stop, notes, updateNotes]);

  const handleCheckIn = useCallback(async () => {
    if (!stop) return;
    const lat = userLat ?? 0;
    const lon = userLon ?? 0;
    // UnitId is required but we pass empty; the store action handles it
    await checkIn(stop.RouteInstanceStopId, '', lat, lon);
  }, [stop, userLat, userLon, checkIn]);

  const handleCheckOut = useCallback(async () => {
    if (!stop) return;
    await checkOut(stop.RouteInstanceStopId, '');
  }, [stop, checkOut]);

  const handleSkip = useCallback(() => {
    if (!stop) return;
    Alert.prompt(
      t('routes.skip'),
      t('routes.skip_reason_placeholder'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('routes.skip'),
          style: 'destructive',
          onPress: (reason?: string) => {
            skip(stop.RouteInstanceStopId, reason ?? '');
          },
        },
      ],
      'plain-text'
    );
  }, [stop, skip]);

  const handleContactPress = useCallback(() => {
    if (!stop?.ContactId) return;
    router.push({ pathname: '/routes/stop/contact' as any, params: { stopId: stop.RouteInstanceStopId } });
  }, [stop]);

  if (isLoadingStops) {
    return (
      <>
        <Stack.Screen options={{ title: t('routes.stop_detail'), headerShown: true, headerBackTitle: '' }} />
        <View className="size-full flex-1">
          <Loading />
        </View>
      </>
    );
  }

  if (!stop) {
    return (
      <>
        <Stack.Screen options={{ title: t('routes.stop_detail'), headerShown: true, headerBackTitle: '' }} />
        <Box className="flex-1 items-center justify-center p-4">
          <MapPinIcon size={48} color="#9ca3af" />
          <Text className="mt-4 text-center text-typography-500">{t('routes.no_routes_description')}</Text>
          <Button onPress={() => router.back()} className="mt-4" variant="outline">
            <ButtonText>{t('common.back')}</ButtonText>
          </Button>
        </Box>
      </>
    );
  }

  const canCheckIn = stop.Status === RouteStopStatus.Pending;
  const canCheckOut = stop.Status === RouteStopStatus.InProgress;
  const canSkip =
    stop.Status === RouteStopStatus.Pending || stop.Status === RouteStopStatus.InProgress;

  return (
    <>
      <Stack.Screen
        options={{
          title: stop.Name || t('routes.stop_detail'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <ScrollView
        className={`flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}
      >
        {/* Header */}
        <Box
          className={`p-4 shadow-sm ${
            colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'
          }`}
        >
          <Heading size="lg">{stop.Name}</Heading>
          {stop.Address ? (
            <Text className="mt-1 text-sm text-typography-500">{stop.Address}</Text>
          ) : null}

          {/* Badges */}
          <HStack className="mt-3 gap-2">
            <Badge action={priorityConfig.action} variant="solid" size="sm">
              <BadgeText>{priorityConfig.label}</BadgeText>
            </Badge>
            <Badge action="info" variant="outline" size="sm">
              <BadgeText>{stopTypeLabel}</BadgeText>
            </Badge>
            <Badge
              action={
                stop.Status === RouteStopStatus.Completed
                  ? 'success'
                  : stop.Status === RouteStopStatus.Skipped
                    ? 'warning'
                    : 'muted'
              }
              variant="solid"
              size="sm"
            >
              <BadgeText>{statusLabel}</BadgeText>
            </Badge>
          </HStack>
        </Box>

        {/* Planned times */}
        <Box
          className={`mt-2 p-4 ${
            colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'
          }`}
        >
          <HStack className="items-center gap-2">
            <ClockIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
            <Text className="text-sm font-medium">Schedule</Text>
          </HStack>
          <HStack className="mt-2 gap-6">
            <VStack>
              <Text className="text-xs text-typography-500">{t('routes.planned_arrival')}</Text>
              <Text className="text-sm font-medium">
                {stop.PlannedArrival
                  ? format(new Date(stop.PlannedArrival), 'MMM d, h:mm a')
                  : '--'}
              </Text>
            </VStack>
            <VStack>
              <Text className="text-xs text-typography-500">{t('routes.planned_departure')}</Text>
              <Text className="text-sm font-medium">
                {stop.PlannedDeparture
                  ? format(new Date(stop.PlannedDeparture), 'MMM d, h:mm a')
                  : '--'}
              </Text>
            </VStack>
          </HStack>
          {stop.DwellTimeMinutes > 0 && (
            <Text className="mt-1 text-xs text-typography-400">
              {t('routes.dwell_time')}: {stop.DwellTimeMinutes} min
            </Text>
          )}
        </Box>

        {/* Mini Map with geofence */}
        {stop.Latitude && stop.Longitude ? (
          <Box className="mt-2" style={{ height: 200 }}>
            <MapView
              style={styles.map}
              styleURL={colorScheme === 'dark' ? StyleURL.Dark : StyleURL.Street}
              scrollEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Camera
                centerCoordinate={[stop.Longitude, stop.Latitude]}
                zoomLevel={15}
                animationMode="moveTo"
              />
              <PointAnnotation id="stop-marker" coordinate={[stop.Longitude, stop.Latitude]}>
                <View style={styles.markerContainer}>
                  <MapPinIcon size={24} color="#ef4444" />
                </View>
              </PointAnnotation>
              {geofenceGeoJson && (
                <ShapeSource id="geofenceSource" shape={geofenceGeoJson}>
                  <FillLayer
                    id="geofenceFill"
                    style={{
                      fillColor: '#3b82f6',
                      fillOpacity: 0.15,
                    }}
                  />
                  <LineLayer
                    id="geofenceBorder"
                    style={{
                      lineColor: '#3b82f6',
                      lineWidth: 2,
                      lineOpacity: 0.5,
                    }}
                  />
                </ShapeSource>
              )}
            </MapView>
          </Box>
        ) : null}

        {/* Contact card */}
        {stop.ContactId ? (
          <Pressable onPress={handleContactPress}>
            <Box
              className={`mt-2 p-4 ${
                colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'
              }`}
            >
              <HStack className="items-center gap-3">
                <Box className="h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                  <UserIcon size={20} color="#3b82f6" />
                </Box>
                <VStack className="flex-1">
                  <Text className="text-sm font-semibold">{t('routes.contact')}</Text>
                  <Text className="text-xs text-typography-500">
                    {t('routes.contact_details')}
                  </Text>
                </VStack>
                <Text className="text-primary-500">{t('calls.view_details')}</Text>
              </HStack>
            </Box>
          </Pressable>
        ) : null}

        {/* Notes */}
        <Box
          className={`mt-2 p-4 ${
            colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'
          }`}
        >
          <Text className="mb-2 text-sm font-medium">{t('routes.notes')}</Text>
          <Textarea size="md" className="mb-3">
            <TextareaInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('routes.notes_placeholder')}
              numberOfLines={4}
            />
          </Textarea>
          <Button
            size="sm"
            variant="outline"
            onPress={handleSaveNotes}
            disabled={isSavingNotes || notes === (stop.Notes ?? '')}
          >
            <ButtonText>{isSavingNotes ? t('common.loading') : t('common.save')}</ButtonText>
          </Button>
        </Box>

        {/* Status action buttons */}
        <Box className="mt-2 gap-3 p-4">
          {canCheckIn && (
            <Button size="lg" className="bg-green-600" onPress={handleCheckIn}>
              <ButtonIcon as={LogInIcon} className="mr-2 text-white" />
              <ButtonText className="text-white">{t('routes.check_in')}</ButtonText>
            </Button>
          )}
          {canCheckOut && (
            <Button size="lg" className="bg-blue-600" onPress={handleCheckOut}>
              <ButtonIcon as={LogOutIcon} className="mr-2 text-white" />
              <ButtonText className="text-white">{t('routes.check_out')}</ButtonText>
            </Button>
          )}
          {canSkip && (
            <Button size="lg" variant="outline" action="warning" onPress={handleSkip}>
              <ButtonIcon as={SkipForwardIcon} className="mr-2" />
              <ButtonText>{t('routes.skip')}</ButtonText>
            </Button>
          )}
          {stop.Status === RouteStopStatus.Completed && (
            <HStack className="items-center justify-center gap-2 py-2">
              <CheckCircleIcon size={20} color="#22c55e" />
              <Text className="font-medium text-green-600">{t('routes.completed')}</Text>
            </HStack>
          )}
        </Box>

        {/* Bottom spacing */}
        <Box className="h-8" />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
