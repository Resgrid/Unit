/**
 * Native implementation of map components using @rnmapbox/maps
 * This file is used on iOS and Android platforms
 */
import Mapbox from '@rnmapbox/maps';

// Re-export all Mapbox components for native platforms
export const MapView = Mapbox.MapView;
export const Camera = Mapbox.Camera;
export const PointAnnotation = Mapbox.PointAnnotation;
export const UserLocation = Mapbox.UserLocation;
export const MarkerView = Mapbox.MarkerView;
export const ShapeSource = Mapbox.ShapeSource;
export const SymbolLayer = Mapbox.SymbolLayer;
export const CircleLayer = Mapbox.CircleLayer;
export const LineLayer = Mapbox.LineLayer;
export const FillLayer = Mapbox.FillLayer;
export const Images = Mapbox.Images;
export const Callout = Mapbox.Callout;

// Export the setAccessToken method
export const setAccessToken = Mapbox.setAccessToken;

// Export StyleURL constants
export const StyleURL = Mapbox.StyleURL;

// Export UserTrackingMode
export const UserTrackingMode = Mapbox.UserTrackingMode;

// Default export for backwards compatibility
export default Mapbox;
