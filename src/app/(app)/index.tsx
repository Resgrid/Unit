import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View } from 'react-native';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import MapPins from '@/components/maps/map-pins';
import { useMapSignalRUpdates } from '@/hooks/use-map-signalr-updates';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { onSortOptions } from '@/lib/utils';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { locationService } from '@/services/location';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

export default function Map() {
  const { t } = useTranslation();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const [mapPins, setMapPins] = useState<MapMakerInfoData[]>([]);
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
  }, [setMapPins]);

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
  }, []);

  const onCameraChanged = (event: any) => {
    if (event.properties.isUserInteraction) {
      setHasUserMovedMap(true);
    }
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
      <View className="size-full flex-1">
        <Mapbox.MapView ref={mapRef} styleURL={styleURL.styleURL} style={styles.map} onCameraChanged={onCameraChanged}>
          <Mapbox.Camera ref={cameraRef} followZoomLevel={12} followUserLocation followUserMode={Mapbox.UserTrackingMode.Follow} />

          {location.latitude && location.longitude && (
            <Mapbox.PointAnnotation id="userLocation" key="userLocation" coordinate={[location.longitude, location.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.View
                style={[
                  styles.markerContainer,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <View style={styles.markerInnerContainer}>
                  <View style={styles.markerDot} />
                  <View
                    style={[
                      styles.directionIndicator,
                      {
                        transform: [{ rotate: `${location.heading || 0}deg` }],
                      },
                    ]}
                  />
                </View>
              </Animated.View>
            </Mapbox.PointAnnotation>
          )}
          <MapPins pins={mapPins} />
        </Mapbox.MapView>
      </View>
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
    width: 50,
    height: 50,
    zIndex: 1,
  },
  markerInnerContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 20,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3498db',
    borderWidth: 3,
    borderColor: '#fff',
  },
  directionIndicator: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#3498db',
    top: -4,
  },
});
