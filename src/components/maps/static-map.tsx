import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import Mapbox from '@/components/maps/mapbox';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Env } from '@/lib/env';

// Ensure Mapbox access token is set before using any Mapbox components
Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

interface StaticMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  zoom?: number;
  height?: number;
  showUserLocation?: boolean;
}

const StaticMap: React.FC<StaticMapProps> = ({ latitude, longitude, address, zoom = 15, height = 200, showUserLocation = false }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();

  // Get map style based on current theme
  const mapStyle = colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street;

  if (!latitude || !longitude) {
    return (
      <Box style={StyleSheet.flatten([styles.container, { height }])} className="items-center justify-center bg-gray-200">
        <Text className="text-gray-500">{t('call_detail.no_location')}</Text>
      </Box>
    );
  }

  return (
    <Box style={StyleSheet.flatten([styles.container, { height }])}>
      <Mapbox.MapView
        style={StyleSheet.flatten([styles.map, { height }])}
        styleURL={mapStyle}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        zoomEnabled={true}
        rotateEnabled={true}
      >
        <Mapbox.Camera zoomLevel={zoom} centerCoordinate={[longitude, latitude]} animationMode="flyTo" animationDuration={1000} />
        {/* Marker pin for the location */}
        <Mapbox.PointAnnotation id="destinationPoint" coordinate={[longitude, latitude]} title={address || 'Location'}>
          <View style={styles.markerContainer}>
            <View style={styles.markerPin} />
            <View style={styles.markerDot} />
          </View>
        </Mapbox.PointAnnotation>

        {/* Show user location if requested */}
        {showUserLocation && <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />}
      </Mapbox.MapView>

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
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 40,
  },
  markerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E53E3E',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  markerDot: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E53E3E',
    marginTop: -2,
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
