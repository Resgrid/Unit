import { useColorScheme } from 'nativewind';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getMapIconKey, getPoiMarkerColor, getPoiMarkerIconClass, getPoiMarkerShapePath, POI_ICON_LAYOUT, POI_MARKER_DIMENSIONS } from '@/lib/poi-marker-utils';

import PoiMarkerIcon from './poi-marker-icon';

/**
 * Props for the PoiMarker component.
 */
export interface PoiMarkerProps {
  /** The icon CSS class name from the API, e.g. "map-icon-hospital" */
  poiImage?: string;
  /** Legacy ImagePath field (null for POIs, but used as fallback) */
  imagePath?: string;
  /** The hex color for the SVG shape fill, e.g. "#2563eb" */
  color?: string;
  /** The marker shape type, e.g. "MAP_PIN", "SHIELD" */
  marker?: string;
  /** Display title for the marker label */
  title: string;
  /** Overall marker size in pixels (width). Height scales proportionally. */
  size?: number;
  /** Callback when the marker is pressed */
  onPress?: () => void;
}

/**
 * Renders a POI (Point of Interest) map marker as an SVG shape
 * filled with the POI type's color, with a white icon overlaid on top.
 *
 * This matches the web app's rendering as described in the
 * "POI Map Icon Renderer — Reference for Mobile Applications" document.
 *
 * Anatomy:
 *   - SVG background shape (MAP_PIN, SHIELD, ROUTE, SQUARE, or SQUARE_ROUNDED)
 *     filled with the Color field, with a drop-shadow
 *   - White icon centered horizontally, 10px from top
 *   - Title label below the marker
 */
const PoiMarker: React.FC<PoiMarkerProps> = React.memo(({ poiImage, imagePath, color, marker, title, size = 36, onPress }) => {
  // Resolve rendering properties (with defaults per the reference document)
  const shapePath = getPoiMarkerShapePath(marker);
  const fillColor = getPoiMarkerColor(color);
  const iconClass = getPoiMarkerIconClass({ PoiImage: poiImage, ImagePath: imagePath });
  const iconKey = getMapIconKey(iconClass);

  // Height scales proportionally: width 36 → height 48, so height = width * (48/36) = width * 4/3
  const svgWidth = size;
  const svgHeight = size * (POI_MARKER_DIMENSIONS.height / POI_MARKER_DIMENSIONS.width);

  // Icon top position scaled relative to the SVG viewBox (topOffset: 10px in 48px height)
  const iconTop = (POI_ICON_LAYOUT.topOffset / POI_MARKER_DIMENSIONS.height) * svgHeight;
  const iconFontSize = (POI_ICON_LAYOUT.fontSize / POI_MARKER_DIMENSIONS.width) * svgWidth;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* SVG background shape with drop shadow */}
      <View style={styles.shapeContainer}>
        <Svg width={svgWidth} height={svgHeight} viewBox="-24 -48 48 48" aria-hidden={true}>
          <Path
            d={shapePath}
            fill={fillColor}
            // Drop shadow: offset(0,1) blur=2 color=rgba(17,24,39,0.35)
            // react-native-svg on iOS/Android supports filter via props
          />
        </Svg>

        {/* White icon overlaid on the shape */}
        <View
          style={[
            styles.iconContainer,
            {
              top: iconTop,
            },
          ]}
          pointerEvents="none"
        >
          <PoiMarkerIcon iconKey={iconKey} size={iconFontSize} />
        </View>
      </View>
      <TitleLabel title={title} />
    </TouchableOpacity>
  );
});

PoiMarker.displayName = 'PoiMarker';

/**
 * Renders the title label below the POI marker shape.
 * Theme-aware colors matching PinMarker's title style.
 */
const TitleLabel: React.FC<{ title: string }> = React.memo(({ title }) => {
  const { colorScheme } = useColorScheme();
  return (
    <Text style={[styles.title, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]} numberOfLines={2}>
      {title}
    </Text>
  );
});
TitleLabel.displayName = 'TitleLabel';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapeContainer: {
    position: 'relative',
    alignItems: 'center',
    // Drop shadow equivalent: offset(0,1) blur=2 color=rgba(17,24,39,0.35)
    ...Platform.select({
      ios: {
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
      default: {
        // Web: CSS filter applied via style
        filter: 'drop-shadow(0 1px 2px rgba(17, 24, 39, 0.35))',
      },
    }),
  },
  iconContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 2,
    overflow: 'visible',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PoiMarker;
