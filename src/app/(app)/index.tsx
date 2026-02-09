import { Stack, useFocusEffect } from 'expo-router';
import { NavigationIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Loading } from '@/components/common/loading';
import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import MapPins from '@/components/maps/map-pins';
import Mapbox from '@/components/maps/mapbox';
import PinDetailModal from '@/components/maps/pin-detail-modal';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useMapSignalRUpdates } from '@/hooks/use-map-signalr-updates';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { locationService } from '@/services/location';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

export default function Map() {
  const { t } = useTranslation();
  const isInitialized = useCoreStore((state) => state.isInitialized);

  // Gate: don't mount the heavy map/location machinery until core init is done
  if (!isInitialized) {
    return <Loading message={t('common.loading')} />;
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
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const [mapPins, setMapPins] = useState<MapMakerInfoData[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapMakerInfoData | null>(null);
  const [isPinDetailModalOpen, setIsPinDetailModalOpen] = useState(false);
  const { isActive } = useAppLifecycle();
  const locationLatitude = useLocationStore((state) => state.latitude);
  const locationLongitude = useLocationStore((state) => state.longitude);
  const locationHeading = useLocationStore((state) => state.heading);
  const isMapLocked = useLocationStore((state) => state.isMapLocked);

  // Get map style based on current theme
  const getMapStyle = useCallback(() => {
    return colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street;
  }, [colorScheme]);

  const [styleURL, setStyleURL] = useState({ styleURL: getMapStyle() });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useMapSignalRUpdates(setMapPins);

  // Update map style when theme changes
  useEffect(() => {
    const newStyle = getMapStyle();
    setStyleURL({ styleURL: newStyle });
  }, [getMapStyle]);

  // Handle navigation focus - reset map state when user navigates back to map page
  useFocusEffect(
    useCallback(() => {
      // Reset hasUserMovedMap when navigating back to map
      setHasUserMovedMap(false);

      // Reset camera to current location when navigating back to map
      if (isMapReady && locationLatitude && locationLongitude) {
        const cameraConfig: any = {
          centerCoordinate: [locationLongitude, locationLatitude],
          zoomLevel: isMapLocked ? 16 : 12,
          animationDuration: 1000,
          heading: 0,
          pitch: 0,
        };

        // Add heading and pitch for navigation mode when locked
        if (isMapLocked && locationHeading !== null && locationHeading !== undefined) {
          cameraConfig.heading = locationHeading;
          cameraConfig.pitch = 45;
        }

        cameraRef.current?.setCamera(cameraConfig);

        logger.info({
          message: 'Map focused, resetting camera to current location',
          context: {
            latitude: locationLatitude,
            longitude: locationLongitude,
            isMapLocked: isMapLocked,
          },
        });
      }
    }, [isMapReady, locationLatitude, locationLongitude, isMapLocked, locationHeading])
  );

  useEffect(() => {
    const startLocationTracking = async () => {
      try {
        await locationService.startLocationUpdates();
        logger.info({
          message: 'Location tracking started successfully',
        });
      } catch (error) {
        logger.error({
          message: 'MapPage: Failed to start location tracking. ' + JSON.stringify(error),
          context: {
            error,
          },
        });

        useToastStore.getState().showToast('error', 'Failed to start location tracking');
      }
    };

    startLocationTracking();

    return () => {
      locationService.stopLocationUpdates();
    };
  }, []);

  useEffect(() => {
    if (isMapReady && locationLatitude && locationLongitude) {
      // When map is locked, always follow the location
      // When map is unlocked, only follow if user hasn't moved the map
      if (isMapLocked || !hasUserMovedMap) {
        const cameraConfig: any = {
          centerCoordinate: [locationLongitude, locationLatitude],
          zoomLevel: isMapLocked ? 16 : 12,
          animationDuration: isMapLocked ? 500 : 1000,
        };

        // Add heading and pitch for navigation mode when locked
        if (isMapLocked && locationHeading !== null && locationHeading !== undefined) {
          cameraConfig.heading = locationHeading;
          cameraConfig.pitch = 45;
        }

        cameraRef.current?.setCamera(cameraConfig);
      }
    }
  }, [isMapReady, locationLatitude, locationLongitude, locationHeading, isMapLocked]);
  // NOTE: hasUserMovedMap intentionally excluded from deps to avoid toggle loop
  // on web where programmatic easeTo → moveend → setHasUserMovedMap(true) → re-trigger.

  // Reset hasUserMovedMap when map gets locked and reset camera when unlocked
  useEffect(() => {
    if (isMapLocked) {
      setHasUserMovedMap(false);
    } else {
      // When exiting locked mode, reset camera to normal view and reset user interaction state
      setHasUserMovedMap(false);

      if (isMapReady && locationLatitude && locationLongitude) {
        cameraRef.current?.setCamera({
          centerCoordinate: [locationLongitude, locationLatitude],
          zoomLevel: 12,
          heading: 0,
          pitch: 0,
          animationDuration: 1000,
        });
      }
    }
    // Only react to lock mode changes — NOT location changes (those are handled above)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapReady, isMapLocked]);

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

  // Only run Animated.loop on native — on web, useNativeDriver falls back to JS driver
  // which creates continuous requestAnimationFrame overhead. Web uses CSS animation instead.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [pulseAnim]);

  // Track when map view is rendered
  useEffect(() => {
    trackEvent('map_view_rendered', {
      hasMapPins: mapPins.length > 0,
      mapPinsCount: mapPins.length,
      isMapLocked: isMapLocked,
      theme: colorScheme || 'light',
    });
  }, [trackEvent, mapPins.length, isMapLocked, colorScheme]);

  const onCameraChanged = useCallback((event: any) => {
    // Only register user interaction if map is not locked
    if (event.properties.isUserInteraction && !isMapLocked) {
      setHasUserMovedMap(true);
    }
  }, [isMapLocked]);

  const handleRecenterMap = () => {
    if (locationLatitude && locationLongitude) {
      const cameraConfig: any = {
        centerCoordinate: [locationLongitude, locationLatitude],
        zoomLevel: isMapLocked ? 16 : 12,
        animationDuration: 1000,
      };

      // Add heading and pitch for navigation mode when locked
      if (isMapLocked && locationHeading !== null && locationHeading !== undefined) {
        cameraConfig.heading = locationHeading;
        cameraConfig.pitch = 45;
      }

      cameraRef.current?.setCamera(cameraConfig);
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
  const showRecenterButton = !isMapLocked && hasUserMovedMap && locationLatitude && locationLongitude;

  // Create dynamic styles based on theme - useMemo to avoid new objects every render
  const themedStyles = useMemo(() => {
    const isDark = colorScheme === 'dark';
    return {
      markerInnerContainer: {
        width: 24,
        height: 24,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        borderWidth: 3,
        borderColor: isDark ? '#1f2937' : '#ffffff',
        elevation: 5,
        shadowColor: isDark ? '#ffffff' : '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.1 : 0.25,
        shadowRadius: 3.84,
      },
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
          <Mapbox.Camera
            ref={cameraRef}
            followZoomLevel={isMapLocked ? 16 : 12}
            followUserLocation={isMapLocked}
            followUserMode={isMapLocked ? Mapbox.UserTrackingMode.FollowWithHeading : undefined}
            followPitch={isMapLocked ? 45 : undefined}
          />

          {locationLatitude && locationLongitude && (
            <Mapbox.PointAnnotation id="userLocation" coordinate={[locationLongitude, locationLatitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.View
                style={[
                  styles.markerContainer,
                  Platform.OS === 'web' ? styles.markerPulseWeb : { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <View style={[styles.markerOuterRing, Platform.OS === 'web' && styles.markerOuterRingPulseWeb]} />
                <View style={[styles.markerInnerContainer, themedStyles.markerInnerContainer]}>
                  <View style={styles.markerDot} />
                  {locationHeading !== null && locationHeading !== undefined && (
                    <View
                      style={[
                        styles.directionIndicator,
                        {
                          transform: [{ rotate: `${locationHeading}deg` }],
                        },
                      ]}
                    />
                  )}
                </View>
              </Animated.View>
            </Mapbox.PointAnnotation>
          )}
          <MapPins pins={mapPins} onPinPress={handlePinPress} />
        </Mapbox.MapView>

        {/* Recenter Button - only show when map is not locked and user has moved the map */}
        {showRecenterButton && (
          <TouchableOpacity style={[styles.recenterButton, themedStyles.recenterButton]} onPress={handleRecenterMap} testID="recenter-button">
            <NavigationIcon size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
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
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    position: 'relative',
  },
  markerOuterRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  markerInnerContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    borderWidth: 3,
    // borderColor and shadow properties are handled by themedStyles
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  directionIndicator: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#3b82f6',
    top: -36,
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
  // Web-only CSS pulse animation (replaces Animated.loop which falls back to JS driver on web)
  markerPulseWeb: {
    // No JS-driven transform on web — the outer ring animates via CSS instead
  } as any,
  markerOuterRingPulseWeb: Platform.OS === 'web'
    ? {
      // @ts-ignore — web-only CSS animation properties
      animationName: 'pulse-ring',
      animationDuration: '2s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
    }
    : ({} as any),
});
