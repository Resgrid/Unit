import { router, Stack, useFocusEffect } from 'expo-router';
import { NavigationIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { Loading } from '@/components/common/loading';
import MapPins from '@/components/maps/map-pins';
import Mapbox from '@/components/maps/mapbox';
import PinDetailModal from '@/components/maps/pin-detail-modal';
import UnitLocationMarker from '@/components/maps/unit-location-marker';
import { StopMarker } from '@/components/routes/stop-marker';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { WeatherAlertBanner } from '@/components/weather-alerts/weather-alert-banner';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useMapSignalRUpdates } from '@/hooks/use-map-signalr-updates';
import { useWeatherAlertBanner } from '@/hooks/use-weather-alert-banner';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { applyPitchHysteresis, applyZoomHysteresis, createCirclePolygon, normalizeHeading, normalizeSpeed, smoothSpeed, zoomForSpeed } from '@/lib/map-camera';
import { getDepartmentMapCenter } from '@/lib/map-center';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { locationService } from '@/services/location';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useMapsStore } from '@/stores/maps/store';
import { useRoutesStore } from '@/stores/routes/store';
import { useToastStore } from '@/stores/toast/store';
import { useWeatherAlertsStore } from '@/stores/weather-alerts/store';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

// Minimum interval between programmatic camera-follow updates. GPS fixes
// arrive every ~15s; without a throttle each fix drives a native camera
// animation plus a full MapContent re-render.
const CAMERA_FOLLOW_THROTTLE_MS = 5000;

export default function Map() {
  const { t } = useTranslation();
  const isInitialized = useCoreStore((state) => state.isInitialized);

  // Gate: don't mount the heavy map/location machinery until core init is done
  if (!isInitialized) {
    return <Loading text={t('common.loading')} />;
  }

  return <MapContent />;
}

function MapContent() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<React.ElementRef<typeof Mapbox.MapView>>(null);
  const cameraRef = useRef<any>(null); // Using any due to imperative handle
  const [isMapReady, setIsMapReady] = useState(false);
  // Ref mirror so the dependency-stable focus effect and the trailing follow
  // timer can read readiness without re-running/capturing a stale value.
  const isMapReadyRef = useRef(false);
  isMapReadyRef.current = isMapReady;
  // Track screen focus so camera follow/animations can be stopped on blur. A camera
  // event delivered while the native map view is tearing down crashes in @rnmapbox/maps
  // (onCameraChanged use-after-free), so we quiet the camera when the user navigates
  // away to shrink that window.
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const isScreenFocusedRef = useRef(true);
  isScreenFocusedRef.current = isScreenFocused;
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  // Ref mirror for the trailing follow-camera timer: hasUserMovedMap is
  // intentionally excluded from the follow effect's deps, so the timer checks
  // this at fire time to avoid recentering over a fresh user pan.
  const hasUserMovedMapRef = useRef(false);
  hasUserMovedMapRef.current = hasUserMovedMap;
  const [mapPins, setMapPins] = useState<MapMakerInfoData[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapMakerInfoData | null>(null);
  const [isPinDetailModalOpen, setIsPinDetailModalOpen] = useState(false);
  const { isActive } = useAppLifecycle();
  const locationLatitude = useLocationStore((state) => state.latitude);
  const locationLongitude = useLocationStore((state) => state.longitude);
  const locationHeading = useLocationStore((state) => state.heading);
  const locationAccuracy = useLocationStore((state) => state.accuracy);
  const locationSpeed = useLocationStore((state) => state.speed);
  const isMapLocked = useLocationStore((state) => state.isMapLocked);

  // Weather alert banner state
  const weatherAlerts = useWeatherAlertsStore((state) => state.alerts);
  const weatherSettings = useWeatherAlertsStore((state) => state.settings);
  const extremeAlerts = useMemo(() => weatherAlerts.filter((a) => a.Severity <= 1 && a.Status === 0), [weatherAlerts]);
  const { bannerAlerts, dismissBanner } = useWeatherAlertBanner(extremeAlerts);

  const handleWeatherAlertBannerPress = useCallback(() => {
    dismissBanner();
    router.push('/(app)/weather-alerts');
  }, [dismissBanner]);

  // Route overlay state
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const activeCallId = useCoreStore((state) => state.activeCallId);
  const activeInstance = useRoutesStore((state) => state.activeInstance);
  const instanceStops = useRoutesStore((state) => state.instanceStops);
  const fetchActiveRoute = useRoutesStore((state) => state.fetchActiveRoute);
  const fetchStopsForInstance = useRoutesStore((state) => state.fetchStopsForInstance);
  const [showRouteOverlay, setShowRouteOverlay] = useState(true);

  // Map layers state
  const activeLayers = useMapsStore((state) => state.activeLayers);
  const layerToggles = useMapsStore((state) => state.layerToggles);
  const cachedGeoJSON = useMapsStore((state) => state.cachedGeoJSON);
  const fetchActiveLayers = useMapsStore((state) => state.fetchActiveLayers);
  const fetchLayerGeoJSON = useMapsStore((state) => state.fetchLayerGeoJSON);

  // Get map style based on current theme
  const getMapStyle = useCallback(() => {
    return colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street;
  }, [colorScheme]);

  const [styleURL, setStyleURL] = useState({ styleURL: getMapStyle() });

  useMapSignalRUpdates(setMapPins);

  // Throttle state for programmatic camera follow (see effect below)
  const lastCameraFollowRef = useRef(0);
  // Trailing-edge timer for the follow throttle: the location store dedupes
  // identical fixes, so an update dropped inside the throttle window may be the
  // last one before the unit stops — deliver it when the window expires.
  const trailingFollowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow-camera state: smoothed ground speed drives the zoom level (walking
  // pace zooms in tight, highway speed pulls out for lookahead), and the last
  // known heading keeps the camera pointed "behind" the unit while stationary
  // fixes report no heading.
  const smoothedSpeedRef = useRef<number | null>(null);
  const followZoomRef = useRef<number | null>(null);
  const followPitchRef = useRef<number>(0);
  const lastBearingRef = useRef<number | null>(null);

  // Previous lock/ready state, so the single camera effect below can tell a lock
  // toggle (or the map first becoming ready) from an ordinary location update.
  const prevIsMapLockedRef = useRef(isMapLocked);
  const prevIsMapReadyRef = useRef(isMapReady);

  const clearTrailingFollow = useCallback(() => {
    if (trailingFollowTimeoutRef.current) {
      clearTimeout(trailingFollowTimeoutRef.current);
      trailingFollowTimeoutRef.current = null;
    }
  }, []);

  /**
   * Camera config that frames the unit like a navigation app: centered on the
   * unit, rotated to its heading, zoomed by its speed, tilted while moving.
   * Reads the location store directly so callers always frame the freshest fix.
   */
  const buildFollowCamera = useCallback((animationDuration: number) => {
    const { latitude, longitude, heading, speed } = useLocationStore.getState();
    if (latitude == null || longitude == null) return null;

    smoothedSpeedRef.current = smoothSpeed(smoothedSpeedRef.current, normalizeSpeed(speed));
    const zoomLevel = applyZoomHysteresis(followZoomRef.current, zoomForSpeed(smoothedSpeedRef.current));
    followZoomRef.current = zoomLevel;

    const currentHeading = normalizeHeading(heading);
    if (currentHeading != null) {
      lastBearingRef.current = currentHeading;
    }
    const bearing = lastBearingRef.current;

    // Tilt behind the unit only while it's actually moving with a known
    // heading; a stationary crew on foot gets a top-down view. Hysteresis
    // keeps the pitch from flipping when speed hovers around the boundary.
    const pitch = bearing != null ? applyPitchHysteresis(followPitchRef.current, smoothedSpeedRef.current) : 0;
    followPitchRef.current = pitch;

    return {
      centerCoordinate: [longitude, latitude] as [number, number],
      zoomLevel,
      heading: bearing ?? 0,
      pitch,
      animationDuration,
    };
  }, []);

  /** Issue exactly one camera command and (re)arm the follow throttle window. */
  const applyFollowCamera = useCallback(
    (animationDuration: number) => {
      const cameraConfig = buildFollowCamera(animationDuration);
      if (!cameraConfig) return null;
      lastCameraFollowRef.current = Date.now();
      cameraRef.current?.setCamera(cameraConfig);
      return cameraConfig;
    },
    [buildFollowCamera]
  );

  // Stable initial camera settings so the native Camera renders at the
  // correct position from the very first frame (fixes Android/iOS centering).
  const initialCameraSettings = useMemo(() => {
    if (locationLatitude != null && locationLongitude != null) {
      return {
        centerCoordinate: [locationLongitude, locationLatitude] as [number, number],
        zoomLevel: zoomForSpeed(normalizeSpeed(locationSpeed)),
        heading: normalizeHeading(locationHeading) ?? 0,
        pitch: 0,
      };
    }

    // Fallback: default US center when location hasn't arrived yet
    return {
      centerCoordinate: [getDepartmentMapCenter().longitude, getDepartmentMapCenter().latitude] as [number, number],
      zoomLevel: 4,
      heading: 0,
      pitch: 0,
    };
    // Initial settings only matter for the first frame — don't churn them on every fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch active route overlay data
  useEffect(() => {
    if (activeUnitId) {
      fetchActiveRoute(activeUnitId);
      fetchActiveLayers();
    }
  }, [activeUnitId, fetchActiveRoute, fetchActiveLayers]);

  // Fetch stops when active instance changes
  useEffect(() => {
    if (activeInstance?.RouteInstanceId) {
      fetchStopsForInstance(activeInstance.RouteInstanceId);
    }
  }, [activeInstance?.RouteInstanceId, fetchStopsForInstance]);

  // Fetch GeoJSON for enabled layers
  useEffect(() => {
    activeLayers.forEach((layer) => {
      if (layerToggles[layer.LayerId] && !cachedGeoJSON[layer.LayerId]) {
        fetchLayerGeoJSON(layer.LayerId);
      }
    });
  }, [activeLayers, layerToggles, cachedGeoJSON, fetchLayerGeoJSON]);

  // Parse route geometry for overlay
  const routeOverlayGeoJSON = useMemo(() => {
    if (!showRouteOverlay || !activeInstance) return null;
    const geometry = activeInstance.ActualRouteGeometry || '';
    if (!geometry) return null;
    try {
      const parsed = JSON.parse(geometry);
      if (parsed.type === 'Feature' || parsed.type === 'FeatureCollection') return parsed;
      if (parsed.type === 'LineString' || parsed.type === 'MultiLineString') {
        return { type: 'Feature' as const, properties: {}, geometry: parsed };
      }
      if (Array.isArray(parsed)) {
        return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString', coordinates: parsed } };
      }
      return null;
    } catch {
      return null;
    }
  }, [showRouteOverlay, activeInstance]);

  // Get remaining stops for route overlay
  const remainingStops = useMemo(() => {
    if (!showRouteOverlay || !activeInstance) return [];
    return instanceStops.filter((s) => s.Status === 0 || s.Status === 1);
  }, [showRouteOverlay, activeInstance, instanceStops]);

  // Next stop for geofence circle
  const nextStop = useMemo(() => {
    return remainingStops.find((s) => s.Status === 0 || s.Status === 1) || null;
  }, [remainingStops]);

  // Geofence circle GeoJSON
  const geofenceGeoJSON = useMemo((): GeoJSON.Feature<GeoJSON.Polygon> | null => {
    if (!nextStop || !nextStop.GeofenceRadiusMeters) return null;
    return createCirclePolygon(nextStop.Longitude, nextStop.Latitude, nextStop.GeofenceRadiusMeters);
  }, [nextStop]);

  // Update map style when theme changes
  useEffect(() => {
    const newStyle = getMapStyle();
    setStyleURL({ styleURL: newStyle });
  }, [getMapStyle]);

  // Handle navigation focus - reset map state when user navigates back to map page.
  // The callback is intentionally dependency-stable (state is read through refs /
  // the store) so it only re-runs on genuine focus/blur transitions — with
  // isMapReady/isMapLocked in the deps it also re-ran on every lock toggle and
  // map-ready flip, issuing a second camera command on top of the lock effect
  // below and double-advancing the speed EMA.
  useFocusEffect(
    useCallback(() => {
      // Mark the screen focused again so camera follow/animations are allowed
      setIsScreenFocused(true);

      // Reset hasUserMovedMap when navigating back to map
      setHasUserMovedMap(false);

      // Reset camera to follow the unit when navigating back to map
      if (isMapReadyRef.current) {
        const cameraConfig = applyFollowCamera(1000);
        if (cameraConfig) {
          logger.info({
            message: 'Map focused, resetting camera to current location',
            context: {
              latitude: cameraConfig.centerCoordinate[1],
              longitude: cameraConfig.centerCoordinate[0],
              isMapLocked: useLocationStore.getState().isMapLocked,
            },
          });
        }
      }

      // On blur (cleanup), stop the camera following/animating before the native
      // map view is detached, so a camera event can't fire into a torn-down view.
      return () => {
        setIsScreenFocused(false);
        clearTrailingFollow();
      };
    }, [applyFollowCamera, clearTrailingFollow])
  );

  useEffect(() => {
    const startLocationTracking = async () => {
      try {
        await locationService.startLocationUpdates();
        logger.info({
          message: 'Location tracking started successfully',
        });
      } catch (error) {
        // NOTE: do not JSON.stringify the error — axios errors carry circular
        // refs and stringify throws inside the catch handler.
        logger.error({
          message: 'MapPage: Failed to start location tracking',
          context: {
            error,
          },
        });

        useToastStore.getState().showToast('error', 'Failed to start location tracking');
      }
    };

    startLocationTracking().catch((error) => {
      logger.error({
        message: 'MapPage: Unexpected error starting location tracking',
        context: { error },
      });
    });

    return () => {
      // Async cleanup — swallow rejections so they don't surface as unhandled
      // promise rejections after unmount.
      locationService.stopLocationUpdates().catch((error) => {
        logger.warn({
          message: 'MapPage: Failed to stop location tracking cleanly',
          context: { error },
        });
      });
    };
  }, []);

  // Single driver for programmatic camera moves. Lock toggles, the map first
  // becoming ready and ordinary location updates all funnel through here so each
  // trigger issues exactly one setCamera — two effects firing back-to-back
  // double-advanced the speed EMA and the zoom hysteresis on every lock toggle.
  useEffect(() => {
    const lockChanged = prevIsMapLockedRef.current !== isMapLocked;
    const becameReady = isMapReady && !prevIsMapReadyRef.current;
    prevIsMapLockedRef.current = isMapLocked;
    prevIsMapReadyRef.current = isMapReady;

    // Toggling the lock (either direction) returns the camera to the default
    // follow-the-unit behavior and clears any manual pan/zoom the user made.
    if (lockChanged) {
      setHasUserMovedMap(false);
    }

    // Skip camera animations while the screen is unfocused so a location update
    // arriving during/after navigation away doesn't drive the (possibly tearing
    // down) native map view.
    if (!isScreenFocused || !isMapReady || locationLatitude == null || locationLongitude == null) {
      return;
    }

    // A lock toggle (or the map becoming ready) recenters right away, bypassing
    // and re-arming the follow throttle.
    if (lockChanged || becameReady) {
      clearTrailingFollow();
      applyFollowCamera(800);
      return;
    }

    // When map is locked, always follow the location.
    // When map is unlocked, follow by default — but stop the moment the user
    // pans/zooms/rotates the map, until they recenter or toggle the lock.
    if (!isMapLocked && hasUserMovedMap) {
      return;
    }

    // Throttle programmatic camera moves — GPS fixes arrive every ~15s and
    // each setCamera triggers a native camera animation + re-render.
    const elapsed = Date.now() - lastCameraFollowRef.current;
    clearTrailingFollow();

    if (elapsed < CAMERA_FOLLOW_THROTTLE_MS) {
      // The location store dedupes identical fixes, so a dropped update can be
      // the last position change before the unit stops. Replay it on the
      // trailing edge instead of parking the camera behind the stopped unit.
      trailingFollowTimeoutRef.current = setTimeout(() => {
        trailingFollowTimeoutRef.current = null;
        if (!isScreenFocusedRef.current || !isMapReadyRef.current) return;
        if (!useLocationStore.getState().isMapLocked && hasUserMovedMapRef.current) return;
        applyFollowCamera(4000);
      }, CAMERA_FOLLOW_THROTTLE_MS - elapsed);
      return;
    }

    // Long animation glides the camera between sparse fixes instead of
    // hopping, approximating continuous navigation-style tracking.
    applyFollowCamera(4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScreenFocused, isMapReady, locationLatitude, locationLongitude, locationHeading, locationSpeed, isMapLocked, applyFollowCamera, clearTrailingFollow]);
  // NOTE: hasUserMovedMap intentionally excluded from deps to avoid toggle loop
  // on web where programmatic easeTo → moveend → setHasUserMovedMap(true) → re-trigger.

  // Drop any pending trailing follow when the map screen goes away.
  useEffect(() => clearTrailingFollow, [clearTrailingFollow]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchMapDataAndMarkers = async () => {
      try {
        const mapDataAndMarkers = await getMapDataAndMarkers(abortController.signal);

        if (mapDataAndMarkers && mapDataAndMarkers.Data) {
          setMapPins(mapDataAndMarkers.Data.MapMakerInfos);
        }
      } catch (error) {
        // Don't log aborted requests as errors
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'canceled')) {
          logger.debug({
            message: 'Map data fetch was aborted during component unmount',
          });
          return;
        }

        logger.error({
          message: 'Failed to fetch initial map data and markers',
          context: { error },
        });
      }
    };

    fetchMapDataAndMarkers();

    // Cleanup function to abort request if component unmounts
    return () => {
      abortController.abort();
    };
  }, []);

  // Track when map view is rendered
  useEffect(() => {
    trackEvent('map_view_rendered', {
      hasMapPins: mapPins.length > 0,
      mapPinsCount: mapPins.length,
      isMapLocked: isMapLocked,
      theme: colorScheme || 'light',
    });
  }, [trackEvent, mapPins.length, isMapLocked, colorScheme]);

  const onCameraChanged = useCallback(
    (event: any) => {
      // Only register user interaction if map is not locked
      if (event.properties.isUserInteraction && !isMapLocked) {
        setHasUserMovedMap(true);
      }
    },
    [isMapLocked]
  );

  const handleRecenterMap = () => {
    clearTrailingFollow();
    if (applyFollowCamera(1000)) {
      setHasUserMovedMap(false);
    }
  };

  const handlePinPress = useCallback((pin: MapMakerInfoData) => {
    setSelectedPin(pin);
    setIsPinDetailModalOpen(true);
  }, []);

  const handleSetAsCurrentCall = async (pin: MapMakerInfoData) => {
    try {
      logger.info({
        message: 'Setting call as current call',
        context: {
          callId: pin.Id,
          callTitle: pin.Title,
        },
      });

      await useCoreStore.getState().setActiveCall(pin.Id);
      useToastStore.getState().showToast('success', t('map.call_set_as_current'));
    } catch (error) {
      logger.error({
        message: 'Failed to set call as current call',
        context: {
          error,
          callId: pin.Id,
          callTitle: pin.Title,
        },
      });

      useToastStore.getState().showToast('error', t('map.failed_to_set_current_call'));
    }
  };

  const handleClosePinDetail = () => {
    setIsPinDetailModalOpen(false);
    setSelectedPin(null);
  };

  // Show recenter button only when map is not locked and user has moved the map
  const showRecenterButton = !isMapLocked && hasUserMovedMap && locationLatitude != null && locationLongitude != null;

  // Create dynamic styles based on theme - useMemo to avoid new objects every render
  const themedStyles = useMemo(() => {
    const isDark = colorScheme === 'dark';
    return {
      recenterButton: {
        position: 'absolute' as const,
        bottom: 20 + insets.bottom,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#3b82f6',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        elevation: 5,
        shadowColor: isDark ? '#ffffff' : '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.1 : 0.25,
        shadowRadius: 3.84,
      },
    };
  }, [colorScheme, insets.bottom]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('tabs.map'),
          headerTitle: t('app.title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1" testID="map-container">
        <FocusAwareStatusBar />
        <Mapbox.MapView
          ref={mapRef}
          styleURL={styleURL.styleURL}
          style={styles.map}
          onCameraChanged={onCameraChanged}
          onDidFinishLoadingMap={() => setIsMapReady(true)}
          testID="map-view"
          scrollEnabled={!isMapLocked}
          zoomEnabled={!isMapLocked}
          rotateEnabled={!isMapLocked}
          pitchEnabled={!isMapLocked}
        >
          {/* Camera is driven imperatively (buildFollowCamera) so locked and
              unlocked modes share the same speed-adaptive follow behavior. */}
          <Mapbox.Camera ref={cameraRef} defaultSettings={initialCameraSettings} />

          <MapPins pins={mapPins} onPinPress={handlePinPress} activeCallId={activeCallId} />

          {/* Active route polyline overlay */}
          {routeOverlayGeoJSON ? (
            <Mapbox.ShapeSource id="active-route-line" shape={routeOverlayGeoJSON}>
              <Mapbox.LineLayer
                id="active-route-line-layer"
                style={{
                  lineColor: activeInstance?.RouteColor || '#3b82f6',
                  lineWidth: 4,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {/* Geofence circle around next stop */}
          {geofenceGeoJSON ? (
            <Mapbox.ShapeSource id="geofence-circle" shape={geofenceGeoJSON}>
              <Mapbox.FillLayer
                id="geofence-fill"
                style={{
                  fillColor: '#3b82f6',
                  fillOpacity: 0.1,
                }}
              />
              <Mapbox.LineLayer
                id="geofence-outline"
                style={{
                  lineColor: '#3b82f6',
                  lineWidth: 1.5,
                  lineDasharray: [2, 2],
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {/* Route stop markers */}
          {showRouteOverlay
            ? remainingStops.map((stop) =>
                stop.Latitude && stop.Longitude ? (
                  <Mapbox.PointAnnotation key={`route-stop-${stop.RouteInstanceStopId}`} id={`route-stop-${stop.RouteInstanceStopId}`} coordinate={[stop.Longitude, stop.Latitude]}>
                    <StopMarker stopOrder={stop.StopOrder} status={stop.Status} />
                  </Mapbox.PointAnnotation>
                ) : null
              )
            : null}

          {/* Custom map layer overlays */}
          {activeLayers.map((layer) =>
            layerToggles[layer.LayerId] && cachedGeoJSON[layer.LayerId] ? (
              <Mapbox.ShapeSource key={`layer-${layer.LayerId}`} id={`layer-${layer.LayerId}`} shape={cachedGeoJSON[layer.LayerId]}>
                <Mapbox.FillLayer
                  id={`fill-${layer.LayerId}`}
                  style={{
                    fillColor: layer.Color || '#3b82f6',
                    fillOpacity: 0.2,
                  }}
                />
                <Mapbox.LineLayer
                  id={`line-${layer.LayerId}`}
                  style={{
                    lineColor: layer.Color || '#3b82f6',
                    lineWidth: 1,
                  }}
                />
              </Mapbox.ShapeSource>
            ) : null
          )}

          {/* Unit location indicator: accuracy circle, heading arrow, dot.
              Rendered last so its layers draw above the overlay fills. */}
          {locationLatitude != null && locationLongitude != null ? <UnitLocationMarker latitude={locationLatitude} longitude={locationLongitude} heading={locationHeading} accuracy={locationAccuracy} /> : null}
        </Mapbox.MapView>

        {/* Weather Alert Banner */}
        {weatherSettings?.WeatherAlertsEnabled && bannerAlerts.length > 0 ? (
          <View style={{ position: 'absolute', top: 8, left: 0, right: 0, zIndex: 10 }}>
            <WeatherAlertBanner alerts={bannerAlerts} onPress={handleWeatherAlertBannerPress} onDismiss={dismissBanner} />
          </View>
        ) : null}

        {/* Recenter Button - only show when map is not locked and user has moved the map */}
        {showRecenterButton ? (
          <TouchableOpacity style={[styles.recenterButton, themedStyles.recenterButton]} onPress={handleRecenterMap} testID="recenter-button">
            <NavigationIcon size={20} color="#ffffff" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Pin Detail Modal */}
      <PinDetailModal pin={selectedPin} isOpen={isPinDetailModalOpen} onClose={handleClosePinDetail} onSetAsCurrentCall={handleSetAsCurrentCall} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    // elevation and shadow properties are handled by themedStyles
  },
});
