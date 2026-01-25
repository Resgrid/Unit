import Mapbox from '@/components/maps/mapbox';
import * as Location from 'expo-location';
import { LocateIcon, MapPinIcon, XIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';

// Ensure Mapbox access token is set before using any Mapbox components
Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

// Default location (center of USA) used when user location is unavailable
const DEFAULT_LOCATION = {
  latitude: 39.8283,
  longitude: -98.5795,
};

// Timeout for location fetching (in milliseconds)
const LOCATION_TIMEOUT = 10000;

interface FullScreenLocationPickerProps {
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
  onLocationSelected: (location: { latitude: number; longitude: number; address?: string }) => void;
  onClose: () => void;
}

const FullScreenLocationPicker: React.FC<FullScreenLocationPickerProps> = ({ initialLocation, onLocationSelected, onClose }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  // Always start with a location - either initial, or default
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  }>(initialLocation || DEFAULT_LOCATION);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [hasUserLocation, setHasUserLocation] = useState(!!initialLocation);
  const isMountedRef = useRef(true);

  const reverseGeocode = React.useCallback(async (latitude: number, longitude: number) => {
    if (!isMountedRef.current) return;

    setIsReverseGeocoding(true);
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (!isMountedRef.current) return;

      if (result && result.length > 0) {
        const { street, name, city, region, country, postalCode } = result[0];
        const addressParts: string[] = [];

        if (street) addressParts.push(street);
        if (name && name !== street) addressParts.push(name);
        if (city) addressParts.push(city);
        if (region) addressParts.push(region);
        if (postalCode) addressParts.push(postalCode);
        if (country) addressParts.push(country);

        setAddress(addressParts.join(', '));
      } else {
        setAddress(undefined);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      if (isMountedRef.current) setAddress(undefined);
    } finally {
      if (isMountedRef.current) setIsReverseGeocoding(false);
    }
  }, []);

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
      reverseGeocode(newLocation.latitude, newLocation.longitude);

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
  }, [reverseGeocode]);

  useEffect(() => {
    isMountedRef.current = true;

    if (initialLocation) {
      setCurrentLocation(initialLocation);
      setHasUserLocation(true);
      reverseGeocode(initialLocation.latitude, initialLocation.longitude);
    } else {
      // Try to get user location, but don't block the map from showing
      getUserLocation();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [initialLocation, getUserLocation, reverseGeocode]);

  const handleMapPress = (event: GeoJSON.Feature) => {
    if (event.geometry.type !== 'GeometryCollection' && 'coordinates' in event.geometry) {
      const coords = event.geometry.coordinates as number[];
      const [longitude, latitude] = coords;
      const newLocation = {
        latitude,
        longitude,
      };
      setCurrentLocation(newLocation);
      setHasUserLocation(true);
      reverseGeocode(newLocation.latitude, newLocation.longitude);
    }
  };

  const handleConfirmLocation = () => {
    onLocationSelected({
      ...currentLocation,
      address,
    });
    onClose();
  };

  return (
    <Box style={styles.container}>
      <Mapbox.MapView ref={mapRef} style={styles.map} logoEnabled={false} attributionEnabled={true} compassEnabled={true} zoomEnabled={true} rotateEnabled={true} onPress={handleMapPress}>
        <Mapbox.Camera ref={cameraRef} zoomLevel={hasUserLocation ? 15 : 4} centerCoordinate={[currentLocation.longitude, currentLocation.latitude]} animationMode="flyTo" animationDuration={1000} />
        {/* Marker for the selected location */}
        <Mapbox.PointAnnotation id="selectedLocation" coordinate={[currentLocation.longitude, currentLocation.latitude]} title="Selected Location">
          <Box className="items-center justify-center">
            <MapPinIcon size={36} color="#FF0000" />
          </Box>
        </Mapbox.PointAnnotation>
      </Mapbox.MapView>

      {/* Close button */}
      <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={onClose}>
        <XIcon size={24} color="#000000" />
      </TouchableOpacity>

      {/* My Location button */}
      <TouchableOpacity style={[styles.myLocationButton, { top: insets.top + 10 }]} onPress={getUserLocation} disabled={isLocating}>
        {isLocating ? <ActivityIndicator size="small" color="#007AFF" /> : <LocateIcon size={24} color="#007AFF" />}
      </TouchableOpacity>

      {/* Location info and confirm button */}
      <Box style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]} className="bg-white p-4 shadow-lg">
        {!hasUserLocation ? <Text className="mb-2 text-center text-amber-600">{t('common.tap_map_to_select')}</Text> : null}
        {isReverseGeocoding ? (
          <Text className="mb-2 text-gray-500">{t('common.loading_address')}</Text>
        ) : address ? (
          <Text className="mb-2 text-gray-700">{address}</Text>
        ) : hasUserLocation ? (
          <Text className="mb-2 text-gray-500">{t('common.no_address_found')}</Text>
        ) : null}

        <Text className="mb-4 text-gray-500">
          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
        </Text>

        <Button onPress={handleConfirmLocation}>
          <ButtonText>{t('common.set_location')}</ButtonText>
        </Button>
      </Box>
    </Box>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
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
  myLocationButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
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
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});

export default FullScreenLocationPicker;
