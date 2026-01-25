import Mapbox from '@/components/maps/mapbox';
import * as Location from 'expo-location';
import { LocateIcon, MapPinIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';

// Ensure Mapbox access token is set before using any Mapbox components
if (!Env.UNIT_MAPBOX_PUBKEY) {
  console.error('Mapbox access token is not configured. Please set UNIT_MAPBOX_PUBKEY in your environment.');
} else {
  Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);
}

// Default location (center of USA) used when user location is unavailable
const DEFAULT_LOCATION = {
  latitude: 39.8283,
  longitude: -98.5795,
};

// Timeout for location fetching (in milliseconds)
const LOCATION_TIMEOUT = 10000;

interface LocationPickerProps {
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
  onLocationSelected: (location: { latitude: number; longitude: number; address?: string }) => void;
  height?: number;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ initialLocation, onLocationSelected, height = 200 }) => {
  const { t } = useTranslation();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const isMountedRef = useRef(true);
  // Always start with a location - either initial, or default
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  }>(initialLocation || DEFAULT_LOCATION);
  const [isLocating, setIsLocating] = useState(false);
  const [hasUserLocation, setHasUserLocation] = useState(!!initialLocation);

  const getUserLocation = React.useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission not granted');
        return;
      }

      // Create a timeout promise with cleanup
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Location timeout')), LOCATION_TIMEOUT);
      });

      // Race between getting location and timeout
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        timeoutPromise,
      ]);

      // Clear timeout if location resolved first
      if (timeoutId !== undefined) clearTimeout(timeoutId);

      if (!isMountedRef.current) return;

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(newLocation);
      setHasUserLocation(true);

      // Move camera to user location
      if (cameraRef.current && isMountedRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [location.coords.longitude, location.coords.latitude],
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      // Don't update location - keep using whatever we have (initial or default)
    } finally {
      if (isMountedRef.current) setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (initialLocation) {
      setCurrentLocation(initialLocation);
      setHasUserLocation(true);
      // Move camera to the new location
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [initialLocation.longitude, initialLocation.latitude],
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    } else {
      // Try to get user location, but don't block the map from showing
      getUserLocation();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [initialLocation, getUserLocation]);

  const handleMapPress = (event: GeoJSON.Feature) => {
    const geometry = event.geometry as GeoJSON.Point;
    const [longitude, latitude] = geometry.coordinates;
    const newLocation = {
      latitude,
      longitude,
    };
    setCurrentLocation(newLocation);
    setHasUserLocation(true);
  };

  const handleConfirmLocation = () => {
    onLocationSelected(currentLocation);
  };

  return (
    <Box style={[styles.container, { height }]}>
      <Mapbox.MapView ref={mapRef} style={styles.map} logoEnabled={false} attributionEnabled={false} compassEnabled={true} zoomEnabled={true} rotateEnabled={true} onPress={handleMapPress}>
        <Mapbox.Camera ref={cameraRef} zoomLevel={hasUserLocation ? 15 : 4} centerCoordinate={[currentLocation.longitude, currentLocation.latitude]} animationMode="flyTo" animationDuration={1000} />
        {/* Marker for the selected location */}
        <Mapbox.PointAnnotation id="selectedLocation" coordinate={[currentLocation.longitude, currentLocation.latitude]} title={t('common.selected_location')}>
          <Box className="items-center justify-center">
            <MapPinIcon size={24} color="#FF0000" />
          </Box>
        </Mapbox.PointAnnotation>
      </Mapbox.MapView>

      {/* My Location button */}
      <TouchableOpacity style={styles.myLocationButton} onPress={getUserLocation} disabled={isLocating} accessibilityLabel={t('common.my_location')} accessibilityRole="button">
        {isLocating ? <ActivityIndicator size="small" color="#007AFF" /> : <LocateIcon size={20} color="#007AFF" />}
      </TouchableOpacity>

      <Box className="absolute inset-x-4 bottom-4">
        <Button onPress={handleConfirmLocation}>
          <ButtonText>{t('common.confirm_location')}</ButtonText>
        </Button>
      </Box>
    </Box>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  map: {
    flex: 1,
  },
  myLocationButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
});

export default LocationPicker;
