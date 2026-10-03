/**
 * Native (iOS/Android) implementation of map components using @rnmapbox/maps
 * Metro bundler resolves this file on native platforms via the .native extension.
 */
import Mapbox from '@rnmapbox/maps';

import { onMapboxAccessTokenChange } from '@/lib/mapbox-token';

// Keep the SDK on the token in use (built-in, or the server-supplied one once Mapbox verified it). Every map
// imports this module, so the subscription exists before any map renders; store listeners run before React
// re-renders, so the SDK has a new token before a map re-renders with a style that needs it.
onMapboxAccessTokenChange((token) => {
  Mapbox.setAccessToken(token);
});

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
export const RasterLayer = Mapbox.RasterLayer;
export const RasterSource = Mapbox.RasterSource;
export const ImageSource = Mapbox.ImageSource;

// Export style URL constants
export const StyleURL = Mapbox.StyleURL;

// Export UserTrackingMode
export const UserTrackingMode = Mapbox.UserTrackingMode;

// Export setAccessToken
export const setAccessToken = Mapbox.setAccessToken;

// Default export matching Mapbox structure with all properties
const MapboxExports = {
  MapView: Mapbox.MapView,
  Camera: Mapbox.Camera,
  PointAnnotation: Mapbox.PointAnnotation,
  UserLocation: Mapbox.UserLocation,
  MarkerView: Mapbox.MarkerView,
  ShapeSource: Mapbox.ShapeSource,
  SymbolLayer: Mapbox.SymbolLayer,
  CircleLayer: Mapbox.CircleLayer,
  LineLayer: Mapbox.LineLayer,
  FillLayer: Mapbox.FillLayer,
  Images: Mapbox.Images,
  Callout: Mapbox.Callout,
  RasterLayer: Mapbox.RasterLayer,
  RasterSource: Mapbox.RasterSource,
  ImageSource: Mapbox.ImageSource,
  StyleURL: Mapbox.StyleURL,
  UserTrackingMode: Mapbox.UserTrackingMode,
  setAccessToken: Mapbox.setAccessToken,
};

export default MapboxExports;
