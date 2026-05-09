/**
 * POI Marker Utilities
 *
 * Implements the POI marker rendering logic as defined in the reference
 * document "POI Map Icon Renderer — Reference for Mobile Applications".
 *
 * Key concepts:
 * - POI markers are identified by Type === 4, PoiTypeId > 0,
 *   LayerId starting with "poi-type-", or PoiImage starting with "map-icon-"
 * - SVG background shapes: MAP_PIN (default), SHIELD, ROUTE, SQUARE, SQUARE_ROUNDED
 * - A white icon from the map-icons font is overlaid on top
 * - All shapes use viewBox="-24 -48 48 48", rendered at 36×48 pixels
 */

/**
 * Marker shape type names (case-insensitive).
 */
export type PoiMarkerShape = 'MAP_PIN' | 'SHIELD' | 'ROUTE' | 'SQUARE' | 'SQUARE_ROUNDED';

/**
 * SVG path data for each POI marker shape.
 * Sourced from the web app at mapTypes.ts:124-130 and map-icons.js:10-15.
 * All paths use viewBox="-24 -48 48 48".
 */
export const POI_MARKER_PATHS: Record<PoiMarkerShape, string> = {
  MAP_PIN: 'M0-48c-9.8 0-17.7 7.8-17.7 17.4 0 15.5 17.7 30.6 17.7 30.6s17.7-15.4 17.7-30.6c0-9.6-7.9-17.4-17.7-17.4z',

  SHIELD:
    'M18.8-31.8c.3-3.4 1.3-6.6 3.2-9.5l-7-6.7c-2.2 1.8-4.8 2.8-7.6 3-2.6.2-5.1-.2-7.5-1.4-2.4 1.1-4.9 1.6-7.5 1.4-2.7-.2-5.1-1.1-7.3-2.7l-7.1 6.7c1.7 2.9 2.7 6 2.9 9.2.1 1.5-.3 3.5-1.3 6.1-.5 1.5-.9 2.7-1.2 3.8-.2 1-.4 1.9-.5 2.5 0 2.8.8 5.3 2.5 7.5 1.3 1.6 3.5 3.4 6.5 5.4 3.3 1.6 5.8 2.6 7.6 3.1.5.2 1 .4 1.5.7l1.5.6c1.2.7 2 1.4 2.4 2.1.5-.8 1.3-1.5 2.4-2.1.7-.3 1.3-.5 1.9-.8.5-.2.9-.4 1.1-.5.4-.1.9-.3 1.5-.6.6-.2 1.3-.5 2.2-.8 1.7-.6 3-1.1 3.8-1.6 2.9-2 5.1-3.8 6.4-5.3 1.7-2.2 2.6-4.8 2.5-7.6-.1-1.3-.7-3.3-1.7-6.1-.9-2.8-1.3-4.9-1.2-6.4z',

  ROUTE:
    'M24-28.3c-.2-13.3-7.9-18.5-8.3-18.7l-1.2-.8-1.2.8c-2 1.4-4.1 2-6.1 2-3.4 0-5.8-1.9-5.9-1.9l-1.3-1.1-1.3 1.1c-.1.1-2.5 1.9-5.9 1.9-2.1 0-4.1-.7-6.1-2l-1.2-.8-1.2.8c-.8.6-8 5.9-8.2 18.7-.2 1.1 2.9 22.2 23.9 28.3 22.9-6.7 24.1-26.9 24-28.3z',

  SQUARE: 'M-24-48h48v48h-48z',

  SQUARE_ROUNDED: 'M24-8c0 4.4-3.6 8-8 8h-32c-4.4 0-8-3.6-8-8v-32c0-4.4 3.6-8 8-8h32c4.4 0 8 3.6 8 8v32z',
};

/**
 * Default values as specified in the reference document.
 */
const DEFAULT_COLOR = '#2563eb';
const DEFAULT_ICON = 'map-icon-map-pin';
const DEFAULT_SHAPE: PoiMarkerShape = 'MAP_PIN';
const MAP_ICON_PREFIX = 'map-icon-';

/**
 * Determines whether a map marker is a POI marker.
 *
 * A marker is a POI when any of these conditions is true:
 * 1. Type === 4 (explicit POI type)
 * 2. PoiTypeId is a number greater than 0
 * 3. LayerId starts with "poi-type-"
 * 4. PoiImage (when not empty) starts with "map-icon-"
 *
 * @param marker - The map marker info data
 * @returns True if the marker is a POI marker
 */
export function isPoiMarker(marker: { Type?: number; PoiTypeId?: number | null; LayerId?: string; PoiImage?: string; ImagePath?: string }): boolean {
  if (marker.Type === 4) return true;
  if (typeof marker.PoiTypeId === 'number' && marker.PoiTypeId > 0) return true;
  if (marker.LayerId?.startsWith('poi-type-')) return true;

  // Check PoiImage first (new field), then ImagePath (legacy compat)
  const iconField = marker.PoiImage || marker.ImagePath;
  if (iconField && iconField.toLowerCase().startsWith(MAP_ICON_PREFIX)) return true;

  return false;
}

/**
 * Returns the SVG path data for a given marker shape type.
 * Falls back to MAP_PIN if the shape is null/empty or unrecognized.
 *
 * @param markerShape - The shape type name (case-insensitive)
 * @returns The SVG path data string
 */
export function getPoiMarkerShapePath(markerShape?: string | null): string {
  const normalized = (markerShape || '').trim().toUpperCase();
  if (!normalized) return POI_MARKER_PATHS[DEFAULT_SHAPE];
  return POI_MARKER_PATHS[normalized as PoiMarkerShape] ?? POI_MARKER_PATHS[DEFAULT_SHAPE];
}

/**
 * Resolves the icon CSS class name for a POI marker.
 * Prefers PoiImage over ImagePath (ImagePath is null for POIs after backend fix).
 * Falls back to "map-icon-map-pin".
 *
 * @param marker - The map marker info data
 * @returns The icon CSS class name (e.g., "map-icon-hospital")
 */
export function getPoiMarkerIconClass(marker: { PoiImage?: string; ImagePath?: string }): string {
  const iconClass = marker.PoiImage || marker.ImagePath;
  if (iconClass && iconClass.length > 0) return iconClass;
  return DEFAULT_ICON;
}

/**
 * Resolves the fill color for a POI marker.
 * Uses the Color field, falling back to #2563eb if null/empty.
 *
 * @param color - The hex color string (may be null/empty)
 * @returns A valid hex color string
 */
export function getPoiMarkerColor(color?: string | null): string {
  if (color && color.length > 0) return color;
  return DEFAULT_COLOR;
}

/**
 * Extracts the icon key name from a map-icon CSS class.
 * E.g., "map-icon-hospital" → "hospital"
 *
 * @param iconClass - The map-icon CSS class name
 * @returns The icon key name, or empty string if not a map-icon class
 */
export function getMapIconKey(iconClass?: string | null): string {
  if (!iconClass) return '';
  const lower = iconClass.toLowerCase();
  if (lower.startsWith(MAP_ICON_PREFIX)) {
    return lower.slice(MAP_ICON_PREFIX.length);
  }
  return '';
}

/**
 * Marker dimensions as specified in the reference document.
 * Width: 36px, Height: 48px, Anchor: [18, 48] (center-bottom).
 */
export const POI_MARKER_DIMENSIONS = {
  width: 36,
  height: 48,
  anchorX: 0.5, // normalized (18/36 = 0.5)
  anchorY: 1.0, // normalized (48/48 = 1.0), bottom-center
} as const;

/**
 * Icon positioning constants within the SVG shape.
 * Icon is centered horizontally, 10px from the top of the 48px-tall shape.
 */
export const POI_ICON_LAYOUT = {
  fontSize: 14,
  color: '#ffffff',
  topOffset: 10, // 10px from top of the 48px shape
} as const;
