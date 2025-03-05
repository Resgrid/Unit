import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { onSortOptions } from '@/lib/utils';
import { locationService } from '@/services/location';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

export default function Map() {
  const { t } = useTranslation();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
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

  useEffect(() => {
    const startLocationTracking = async () => {
      try {
        await locationService.startLocationUpdates();
      } catch (error) {
        logger.error({
          message:
            'MapPage: Failed to start location tracking. ' +
            JSON.stringify(error),
          context: {
            error,
          },
        });

        useToastStore
          .getState()
          .showToast('error', 'Failed to start location tracking');
      }
    };

    startLocationTracking();

    return () => {
      locationService.stopLocationUpdates();
    };
  }, []);

  useEffect(() => {
    if (location.latitude && location.longitude && !hasUserMovedMap) {
      cameraRef.current?.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: 12,
        animationDuration: 1000,
      });
    }
  }, [location.latitude, location.longitude, hasUserMovedMap]);

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
        <Mapbox.MapView
          ref={mapRef}
          styleURL={styleURL.styleURL}
          style={styles.map}
          onCameraChanged={onCameraChanged}
        >
          <Mapbox.Camera
            ref={cameraRef}
            followZoomLevel={12}
            followUserLocation
            followUserMode={Mapbox.UserTrackingMode.Follow}
          />

          {location.latitude && location.longitude && (
            <Mapbox.PointAnnotation
              id="userLocation"
              coordinate={[location.longitude, location.latitude]}
            >
              <View style={styles.markerContainer}>
                <Image
                  source={require('@assets/images/user-marker.png')}
                  style={[
                    styles.markerImage,
                    {
                      transform: [{ rotate: `${location.heading || 0}deg` }],
                    },
                  ]}
                />
              </View>
            </Mapbox.PointAnnotation>
          )}
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
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  markerImage: {
    width: 40,
    height: 40,
  },
});
