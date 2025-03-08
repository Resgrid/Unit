import type Mapbox from '@rnmapbox/maps';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { MAP_ICONS } from '@/constants/map-icons';

type MapIconKey = keyof typeof MAP_ICONS;

interface PinMarkerProps {
  imagePath?: string;
  title: string;
  size?: number;
  markerRef?: Mapbox.PointAnnotation | null;
}

const PinMarker: React.FC<PinMarkerProps> = ({ imagePath, title, size = 32, markerRef }) => {
  const { colorScheme } = useColorScheme();

  const iconKey = (imagePath?.toLowerCase() ?? 'person') as MapIconKey;
  const icon = MAP_ICONS[iconKey];

  if (icon && icon.uri) {
    return (
      <View style={styles.container}>
        <Image source={icon.uri} style={[styles.image, { width: size, height: size }]} onLoad={() => markerRef?.refresh()} />
        <Text style={[styles.title, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
    );
  } else {
    return (
      <View style={styles.container}>
        <Text>{title}</Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    //minHeight: 40,
    minWidth: 100,
    //maxWidth: 180,
    zIndex: 1,
  },
  image: {
    resizeMode: 'cover',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  title: {
    //position: 'fixed',
    //top: 34,
    overflow: 'visible',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default PinMarker;
