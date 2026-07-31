import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';
import { useLocationStore } from '@/stores/app/location-store';

interface StaticMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  zoom?: number;
  height?: number;
  showUserLocation?: boolean;
}

/**
 * Renders a map snapshot via the Mapbox Static Images API instead of mounting
 * a full interactive Mapbox GL map (style load, tile downloads, GL context per
 * instance) — call/POI detail screens open noticeably faster and hold far less
 * native memory. The destination (and optionally the user's own position) are
 * drawn as pins.
 */
const StaticMap: React.FC<StaticMapProps> = ({ latitude, longitude, address, zoom = 15, height = 200, showUserLocation = false }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();

  const imageUrl = React.useMemo(() => {
    if (!latitude || !longitude) {
      return null;
    }

    const styleId = colorScheme === 'dark' ? 'mapbox/dark-v11' : 'mapbox/streets-v12';
    const pins: string[] = [`pin-s+E53E3E(${longitude},${latitude})`];

    // Snapshot of the user's own position (no subscription needed for a static image)
    let position = `${longitude},${latitude},${zoom}`;
    if (showUserLocation) {
      const { latitude: userLat, longitude: userLon } = useLocationStore.getState();
      if (userLat !== null && userLon !== null) {
        pins.push(`pin-s+3B82F6(${userLon},${userLat})`);
        // 'auto' fits the viewport to both pins
        position = 'auto';
      }
    }

    // Match the requested image width to the actual view width (capped at the
    // Static Images API max of 1280) so the 'auto' viewport fits the rendered
    // aspect ratio — otherwise wide landscape views crop the pins off-center.
    const width = Math.min(Math.max(Math.round(windowWidth), 1), 1280);

    return `https://api.mapbox.com/styles/v1/${styleId}/static/${pins.join(',')}/${position}/${width}x${Math.round(height)}@2x?access_token=${Env.UNIT_MAPBOX_PUBKEY}&logo=false&attribution=false`;
  }, [latitude, longitude, zoom, height, showUserLocation, colorScheme, windowWidth]);

  if (!imageUrl) {
    return (
      <Box style={StyleSheet.flatten([styles.container, { height }])} className="items-center justify-center bg-gray-200">
        <Text className="text-gray-500">{t('call_detail.no_location')}</Text>
      </Box>
    );
  }

  return (
    <Box style={StyleSheet.flatten([styles.container, { height }])}>
      <Image source={{ uri: imageUrl }} style={StyleSheet.flatten([styles.map, { height }])} resizeMode="cover" accessibilityLabel={address || 'Map'} />

      {/* Address overlay */}
      {address && (
        <Box style={styles.addressContainer}>
          <Text style={styles.addressText}>{address}</Text>
        </Box>
      )}
    </Box>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  addressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  addressText: {
    color: 'white',
    fontSize: 12,
  },
});

export default StaticMap;
