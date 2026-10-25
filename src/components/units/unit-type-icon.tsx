import { Image, type ImageContentFit } from 'expo-image';
import React, { useState } from 'react';

import { MAP_ICONS } from '@/constants/map-icons';

type MapIconKey = keyof typeof MAP_ICONS;

export interface UnitTypeIconProps {
  /** Absolute URL of the department's uploaded icon for the unit's type (`TypeIconUrl`). */
  iconUrl?: string | null;
  /** Built-in icon name the unit's type picked (`TypeMapIcon`), a `MAP_ICONS` key. */
  mapIcon?: string | null;
  /** Width and height of the square the icon is fitted into. */
  size?: number;
  /** How the image is fitted into that square: `contain` (the default) for square uploads, `cover` to match an image drawn the way the bundled map pins are. */
  contentFit?: ImageContentFit;
  /** Rendered when there is no icon to show (no upload, unknown built-in name, or the upload failed to load). */
  fallback?: React.ReactNode;
  testID?: string;
}

/** The bundled `MAP_ICONS` key for a unit type's built-in icon name, or null when it is not one. */
export const getUnitTypeMapIconKey = (mapIcon?: string | null): MapIconKey | null => {
  if (typeof mapIcon !== 'string') return null;
  const key = mapIcon.trim().toLowerCase();
  return key && Object.prototype.hasOwnProperty.call(MAP_ICONS, key) ? (key as MapIconKey) : null;
};

/**
 * The icon a department gave a unit's type, shown next to the unit's name: the uploaded image when there
 * is one, else the type's built-in map icon, else `fallback`. A failed upload falls through to the
 * built-in icon. Decorative: the unit name next to it already says what it is.
 */
export const UnitTypeIcon: React.FC<UnitTypeIconProps> = React.memo(({ iconUrl, mapIcon, size = 24, contentFit = 'contain', fallback = null, testID }) => {
  const url = typeof iconUrl === 'string' ? iconUrl.trim() : '';
  // Keyed by URL so a new upload (new URL) gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const showUrl = url.length > 0 && failedUrl !== url;
  const mapIconKey = getUnitTypeMapIconKey(mapIcon);

  if (!showUrl && !mapIconKey) {
    return <>{fallback}</>;
  }

  return (
    <Image
      testID={testID}
      source={showUrl ? { uri: url } : MAP_ICONS[mapIconKey as MapIconKey].uri}
      recyclingKey={showUrl ? url : mapIconKey}
      style={{ width: size, height: size }}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={0}
      onError={showUrl ? () => setFailedUrl(url) : undefined}
      // Web: an <img> is draggable by default, so grabbing a map pin would drag a ghost image instead of
      // panning the map. react-native-web's Image (the bundled pins) already renders draggable={false}.
      draggable={false}
      accessible={false}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    />
  );
});

UnitTypeIcon.displayName = 'UnitTypeIcon';

/**
 * Type-neutral name for the same component, for call type and POI type icons: `iconUrl` is the type's
 * uploaded icon, `mapIcon` its built-in `MAP_ICONS` name (call types; POI types have none).
 */
export const TypeIcon = UnitTypeIcon;

export default UnitTypeIcon;
