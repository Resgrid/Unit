import React from 'react';
import { StyleSheet } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import Mapbox from '@rnmapbox/maps';

// Initialize Mapbox - this should be done in your app's entry point
// Mapbox.setAccessToken('YOUR_MAPBOX_ACCESS_TOKEN');

interface StaticMapProps {
  latitude: string;
  longitude: string;
  address?: string;
  zoom?: number;
  height?: number;
  showUserLocation?: boolean;
}

const StaticMap: React.FC<StaticMapProps> = ({
  latitude,
  longitude,
  address,
  zoom = 15,
  height = 200,
  showUserLocation = false,
}) => {
  if (!latitude || !longitude) {
    return (
      <Box
        style={[styles.container, { height }]}
        className="items-center justify-center bg-gray-200"
      >
        <Text className="text-gray-500">No location data available</Text>
      </Box>
    );
  }

  return (
    <Box style={[styles.container, { height }]}>
      <Mapbox.MapView
        style={styles.map}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        zoomEnabled={true}
        rotateEnabled={true}
      >
        <Mapbox.Camera
          zoomLevel={zoom}
          centerCoordinate={[parseFloat(longitude), parseFloat(latitude)]}
          animationMode="flyTo"
          animationDuration={1000}
        />
        {/* Marker for the location */}
        <Mapbox.PointAnnotation
          id="destinationPoint"
          coordinate={[parseFloat(longitude), parseFloat(latitude)]}
          title={address || 'Location'}
        >
          <Box />
        </Mapbox.PointAnnotation>

        {/* Show user location if requested */}
        {showUserLocation && (
          <Mapbox.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
        )}
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
