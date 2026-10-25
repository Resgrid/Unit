import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PointAnnotation } from '@/components/maps/mapbox';
import { UnitTypeIcon } from '@/components/units/unit-type-icon';
import { MAP_ICONS } from '@/constants/map-icons';
import { getTypeIconUrl } from '@/lib/type-icons';

type MapIconKey = keyof typeof MAP_ICONS;

interface PinMarkerProps {
  imagePath?: MapIconKey;
  poiImage?: MapIconKey;
  /** The department's uploaded icon for the pin's unit type, call type or (personnel pins) role; the bundled icon is used when absent or it fails to load. */
  iconUrl?: string | null;
  /**
   * The bundled pin recoloured to the call's priority or the unit's/person's status (`PinIconUrl`). Drawn in place of the
   * bundled pin, in the same box and fit, when there is no `iconUrl`; the bundled pin is used when absent or it fails to load.
   */
  pinIconUrl?: string | null;
  title: string;
  size?: number;
  markerRef?: React.ComponentRef<typeof PointAnnotation> | null;
  /** Highlights the marker with a ring — used for the department's active call. */
  isActive?: boolean;
  onPress?: () => void;
}

export interface PinMarkerIconProps {
  /** Bundled `MAP_ICONS` name (any case); unknown or missing names draw the neutral flag pin. */
  imagePath?: string | null;
  /** Preferred over `imagePath` when set. */
  poiImage?: string | null;
  /** The department's uploaded icon; see `PinMarkerProps.iconUrl`. */
  iconUrl?: string | null;
  /** The status/priority-coloured pin; see `PinMarkerProps.pinIconUrl`. */
  pinIconUrl?: string | null;
  size?: number;
}

/**
 * The image a map pin draws: the uploaded icon (`iconUrl`, contain fit) when there is one, else the status/priority-coloured
 * pin (`pinIconUrl`), else the bundled pin. A failed upload falls back to the styled pin, a failed styled pin to the bundled one.
 * Shared by the map's pins and the map legend, so a legend icon is exactly what the map draws.
 */
export const PinMarkerIcon: React.FC<PinMarkerIconProps> = React.memo(({ imagePath, poiImage, iconUrl, pinIconUrl, size = 32 }) => {
  // Prefer poiImage (new field) over imagePath (null for POIs after backend fix),
  // with final fallback to default 'call' icon
  const resolvedPath = poiImage || imagePath;
  const iconKey = resolvedPath?.toLowerCase() as MapIconKey;
  // Unknown markers fall back to a neutral pin, not the call icon -- that one is a flame.
  const icon = iconKey && Object.prototype.hasOwnProperty.call(MAP_ICONS, iconKey) ? MAP_ICONS[iconKey] : MAP_ICONS['flag'];

  const bundledImage = <Image fadeDuration={0} source={icon.uri} style={[styles.image, { width: size, height: size }]} />;
  // The status/priority-coloured copy of the bundled pin: same shape, box and cover fit, no tint (it already carries the
  // colour). Falls back to the bundled pin when the server sends none or it fails to load.
  const styledPinUrl = getTypeIconUrl(pinIconUrl);
  const styledPinImage = styledPinUrl ? <UnitTypeIcon iconUrl={styledPinUrl} size={size} contentFit="cover" fallback={bundledImage} testID="pin-styled-icon" /> : bundledImage;
  // An uploaded icon wins. Same footprint as the bundled pin; falls back to the styled pin, then the bundled one, when it fails to load.
  return iconUrl ? <UnitTypeIcon iconUrl={iconUrl} size={size} fallback={styledPinImage} testID="pin-type-icon" /> : styledPinImage;
});

PinMarkerIcon.displayName = 'PinMarkerIcon';

const PinMarker: React.FC<PinMarkerProps> = React.memo(({ imagePath, poiImage, iconUrl, pinIconUrl, title, size = 32, isActive = false, onPress }) => {
  const { colorScheme } = useColorScheme();

  const ringSize = size + 16;

  const pinImage = <PinMarkerIcon imagePath={imagePath} poiImage={poiImage} iconUrl={iconUrl} pinIconUrl={pinIconUrl} size={size} />;

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
