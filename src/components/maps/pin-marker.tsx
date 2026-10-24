import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PointAnnotation } from '@/components/maps/mapbox';
import { UnitTypeIcon } from '@/components/units/unit-type-icon';
import { MAP_ICONS } from '@/constants/map-icons';

type MapIconKey = keyof typeof MAP_ICONS;

interface PinMarkerProps {
  imagePath?: MapIconKey;
  poiImage?: MapIconKey;
  /** The department's uploaded icon for the pin's unit type, call type or (personnel pins) role; the bundled icon is used when absent or it fails to load. */
  iconUrl?: string | null;
  title: string;
  size?: number;
  markerRef?: React.ComponentRef<typeof PointAnnotation> | null;
  /** Highlights the marker with a ring — used for the department's active call. */
  isActive?: boolean;
  onPress?: () => void;
}

const PinMarker: React.FC<PinMarkerProps> = React.memo(({ imagePath, poiImage, iconUrl, title, size = 32, isActive = false, onPress }) => {
  const { colorScheme } = useColorScheme();

  // Prefer poiImage (new field) over imagePath (null for POIs after backend fix),
  // with final fallback to default 'call' icon
  const resolvedPath = poiImage || imagePath;
  const iconKey = resolvedPath?.toLowerCase() as MapIconKey;
  // Unknown markers fall back to a neutral pin, not the call icon -- that one is a flame.
  const icon = iconKey && MAP_ICONS[iconKey] ? MAP_ICONS[iconKey] : MAP_ICONS['flag'];

  const ringSize = size + 16;

  const bundledImage = <Image fadeDuration={0} source={icon.uri} style={[styles.image, { width: size, height: size }]} />;
  // Same footprint as the bundled pin; falls back to it when there is no upload or it fails to load.
  const pinImage = iconUrl ? <UnitTypeIcon iconUrl={iconUrl} size={size} fallback={bundledImage} testID="pin-type-icon" /> : bundledImage;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {isActive ? (
        <View style={[styles.iconWrapper, { width: ringSize, height: ringSize }]}>
          <View testID="pin-active-ring" style={[styles.activeRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]} />
          {pinImage}
        </View>
      ) : (
        pinImage
      )}
      <Text style={[styles.title, isActive ? styles.titleActive : { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]} numberOfLines={2}>
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
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRing: {
    position: 'absolute',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 3,
    borderColor: '#ef4444',
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
  // The active call label keeps a fixed accent color (readable on both themes)
  // so the highlighted pin stands out from the rest.
  titleActive: {
    color: '#ef4444',
  },
});

export default PinMarker;
