import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import { NavigationIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import MapPins from '@/components/maps/map-pins';
import PinDetailModal from '@/components/maps/pin-detail-modal';
import { useMapSignalRUpdates } from '@/hooks/use-map-signalr-updates';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { onSortOptions } from '@/lib/utils';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { locationService } from '@/services/location';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

export default function Map() {
  const { t } = useTranslation();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const [mapPins, setMapPins] = useState<MapMakerInfoData[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapMakerInfoData | null>(null);
  const [isPinDetailModalOpen, setIsPinDetailModalOpen] = useState(false);
  const location = useLocationStore((state) => ({
    latitude: state.latitude,
    longitude: state.longitude,
    heading: state.heading,
  }));

  const _mapOptions = Object.keys(Mapbox.StyleURL)
    .map((key) => {
      return {
        label: key,
        data: (Mapbox.StyleURL as any)[key],
      };
    })
    .sort(onSortOptions);

  const [styleURL] = useState({ styleURL: _mapOptions[0].data });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useMapSignalRUpdates(setMapPins);

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
    if (location.latitude && location.longitude) {
      logger.info({
        message: 'Location updated',
        context: {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading,
        },
      });

      if (!hasUserMovedMap) {
        cameraRef.current?.setCamera({
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: 12,
          animationDuration: 1000,
        });
      }
    }
  }, [location.latitude, location.longitude, location.heading, hasUserMovedMap]);

  useEffect(() => {
    const fetchMapDataAndMarkers = async () => {
      const mapDataAndMarkers = await getMapDataAndMarkers();

      if (mapDataAndMarkers && mapDataAndMarkers.Data) {
        setMapPins(mapDataAndMarkers.Data.MapMakerInfos);
      }
    };

    fetchMapDataAndMarkers();
  }, []);

  useEffect(() => {
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
  }, [pulseAnim]);

  const onCameraChanged = (event: any) => {
    if (event.properties.isUserInteraction) {
      setHasUserMovedMap(true);
    }
  };

  const handleRecenterMap = () => {
    if (location.latitude && location.longitude) {
      cameraRef.current?.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: 12,
        animationDuration: 1000,
      });
      setHasUserMovedMap(false);
    }
  };

  const handlePinPress = (pin: MapMakerInfoData) => {
    setSelectedPin(pin);
    setIsPinDetailModalOpen(true);
  };

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

  return (
    <>
      <Stack.Screen
        options={{
          title: t('tabs.map'),
          headerTitle: t('app.title'),
          headerShown: true,
        }}
      />
      <View className="size-full flex-1" testID="map-container">
        <Mapbox.MapView ref={mapRef} styleURL={styleURL.styleURL} style={styles.map} onCameraChanged={onCameraChanged} testID="map-view">
          <Mapbox.Camera ref={cameraRef} followZoomLevel={12} followUserLocation followUserMode={Mapbox.UserTrackingMode.Follow} />

          {location.latitude && location.longitude && (
            <Mapbox.PointAnnotation id="userLocation" coordinate={[location.longitude, location.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.View
                style={[
                  styles.markerContainer,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <View style={styles.markerOuterRing} />
                <View style={styles.markerInnerContainer}>
                  <View style={styles.markerDot} />
                  {location.heading !== null && location.heading !== undefined && (
                    <View
                      style={[
                        styles.directionIndicator,
                        {
                          transform: [{ rotate: `${location.heading}deg` }],
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

        {/* Recenter Button */}
        {hasUserMovedMap && location.latitude && location.longitude && (
          <TouchableOpacity style={styles.recenterButton} onPress={handleRecenterMap} testID="recenter-button">
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
    borderColor: '#ffffff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
