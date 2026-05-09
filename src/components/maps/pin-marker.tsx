import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';

import type { PointAnnotation } from '@/components/maps/mapbox';
import { MAP_ICONS } from '@/constants/map-icons';

type MapIconKey = keyof typeof MAP_ICONS;

interface PinMarkerProps {
  imagePath?: MapIconKey;
  poiImage?: MapIconKey;
  title: string;
  size?: number;
  markerRef?: React.ComponentRef<typeof PointAnnotation> | null;
  onPress?: () => void;
}

const PinMarker: React.FC<PinMarkerProps> = React.memo(({ imagePath, poiImage, title, size = 32, onPress }) => {
  const { colorScheme } = useColorScheme();

  // Prefer poiImage (new field) over imagePath (null for POIs after backend fix),
  // with final fallback to default 'call' icon
  const resolvedPath = poiImage || imagePath;
  const iconKey = resolvedPath?.toLowerCase() as MapIconKey;
  const icon = iconKey && MAP_ICONS[iconKey] ? MAP_ICONS[iconKey] : MAP_ICONS['call'];

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Image fadeDuration={0} source={icon.uri} style={[styles.image, { width: size, height: size }]} />
      <Text style={[styles.title, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
});

PinMarker.displayName = 'PinMarker';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    overflow: 'visible',
    resizeMode: 'cover',
  },
  title: {
    marginTop: 2,
    overflow: 'visible',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PinMarker;
