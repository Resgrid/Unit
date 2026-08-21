import * as Location from 'expo-location';
import { LocateIcon, MapPinIcon, XIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Mapbox from '@/components/maps/mapbox';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { getDepartmentMapCenter } from '@/lib/map-center';

// Ensure Mapbox access token is set before using any Mapbox components
Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

// Falls back to the department's configured map center rather than a hardcoded point, so a
// department outside the US does not open every picker on the middle of Kansas.

// Timeout for location fetching (in milliseconds)
const LOCATION_TIMEOUT = 10000;
// Distinguishes our own timeout rejection from a genuine platform failure in the catch,
// so an expected slow fix logs at warn instead of paging Sentry.
const LOCATION_TIMEOUT_MESSAGE = 'Location timeout';

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
  // Read live rather than at StyleSheet-create time — a module-level
  // Dimensions.get('window') keeps the pre-rotation size forever.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cameraRef = useRef<any>(null); // Using any due to imperative handle
  // Always start with a location - either initial, or default
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  }>(initialLocation || getDepartmentMapCenter());
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [hasUserLocation, setHasUserLocation] = useState(!!initialLocation);
  const isMountedRef = useRef(true);
  // Held in a ref so both the `finally` below and the unmount cleanup can cancel a pending
  // timer. Left uncleared, every failed fix keeps a 10s closure over this component alive.
  const locationTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearLocationTimeout = React.useCallback(() => {
    if (locationTimeoutRef.current !== undefined) {
      clearTimeout(locationTimeoutRef.current);
      locationTimeoutRef.current = undefined;
    }
  }, []);

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
      // Transient (offline / geocoder unavailable) and the UI degrades to "no address found".
      logger.warn({ message: 'Reverse geocode failed for the location picker', context: { error, latitude, longitude } });
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
        // Expected outcome of a user choice, not a fault — the picker falls back to the map centre.
        logger.warn({ message: 'Location permission not granted for the location picker', context: { status } });
        return;
      }

      // Any previous attempt's timer is cancelled before arming a new one, so repeated
      // "my location" taps cannot stack timers.
      clearLocationTimeout();
      const timeoutPromise = new Promise<never>((_, reject) => {
        locationTimeoutRef.current = setTimeout(() => reject(new Error(LOCATION_TIMEOUT_MESSAGE)), LOCATION_TIMEOUT);
      });

      // Race between getting location and timeout
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        timeoutPromise,
      ]);

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
      // Don't update location - keep using whatever we have (initial or default)
      if (error instanceof Error && error.message === LOCATION_TIMEOUT_MESSAGE) {
        logger.warn({ message: 'Timed out getting the device location for the location picker', context: { timeoutMs: LOCATION_TIMEOUT } });
      } else {
        logger.error({ message: 'Failed to get the device location for the location picker', context: { error } });
      }
    } finally {
      // Runs on every path — resolved, rejected and the permission-denied early return —
      // so a rejected fix can never leave the 10s timer armed.
      clearLocationTimeout();
      if (isMountedRef.current) setIsLocating(false);
    }
  }, [reverseGeocode, clearLocationTimeout]);

  // Depend on the coordinates rather than the object: `initialLocation` is a new identity on
  // every parent render for any caller passing an object literal, which would re-run the effect
  // and re-fly the camera, clobbering a location the user had already tapped.
  const initialLatitude = initialLocation?.latitude;
  const initialLongitude = initialLocation?.longitude;

  useEffect(() => {
    isMountedRef.current = true;

    if (initialLatitude !== undefined && initialLongitude !== undefined) {
      setCurrentLocation({ latitude: initialLatitude, longitude: initialLongitude });
      setHasUserLocation(true);
      reverseGeocode(initialLatitude, initialLongitude);
      // Camera is imperative-only, so move it here rather than through props.
      cameraRef.current?.setCamera({
        centerCoordinate: [initialLongitude, initialLatitude],
        zoomLevel: 15,
        animationDuration: 1000,
      });
    } else {
      // Try to get user location, but don't block the map from showing
      getUserLocation();
    }

    return () => {
      isMountedRef.current = false;
      clearLocationTimeout();
    };
  }, [initialLatitude, initialLongitude, getUserLocation, reverseGeocode, clearLocationTimeout]);

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
    <Box style={[styles.container, { width: windowWidth, height: windowHeight }]}>
      <Mapbox.MapView style={styles.map} logoEnabled={false} attributionEnabled={true} compassEnabled={true} zoomEnabled={true} rotateEnabled={true} onPress={handleMapPress}>
        {/* Camera is driven imperatively only (see getUserLocation). Passing
            centerCoordinate as well made every map tap re-fly the camera to the
            tapped point and updated the camera mid-pan, fighting the gesture. */}
        <Mapbox.Camera ref={cameraRef} defaultSettings={{ centerCoordinate: [currentLocation.longitude, currentLocation.latitude], zoomLevel: hasUserLocation ? 15 : 4 }} />
        {/* Marker for the selected location */}
        <Mapbox.PointAnnotation id="selectedLocation" coordinate={[currentLocation.longitude, currentLocation.latitude]} title="Selected Location">
          <Box className="items-center justify-center">
            <MapPinIcon size={36} color="#FF0000" />
          </Box>
        </Mapbox.PointAnnotation>
      </Mapbox.MapView>

      {/* Close button */}
      <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
        <XIcon size={24} color="#000000" />
      </TouchableOpacity>

      {/* My Location button */}
      <TouchableOpacity style={[styles.myLocationButton, { top: insets.top + 10 }]} onPress={getUserLocation} disabled={isLocating} accessibilityRole="button" accessibilityLabel={t('common.get_my_location')}>
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
