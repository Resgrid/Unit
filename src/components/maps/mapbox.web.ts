/**
 * Web/Electron implementation of map components using mapbox-gl
 * Metro bundler resolves this file on web platforms via the .web extension.
 */
import * as MapboxWeb from './map-view.web';

// Re-export all components from the web implementation
export const MapView = MapboxWeb.MapView;
export const Camera = MapboxWeb.Camera;
export const PointAnnotation = MapboxWeb.PointAnnotation;
export const UserLocation = MapboxWeb.UserLocation;
export const MarkerView = MapboxWeb.MarkerView;
export const ShapeSource = MapboxWeb.ShapeSource;
export const SymbolLayer = MapboxWeb.SymbolLayer;
export const CircleLayer = MapboxWeb.CircleLayer;
export const LineLayer = MapboxWeb.LineLayer;
export const FillLayer = MapboxWeb.FillLayer;
export const Images = MapboxWeb.Images;
export const Callout = MapboxWeb.Callout;
export const RasterLayer = MapboxWeb.RasterLayer;
export const RasterSource = MapboxWeb.RasterSource;
export const ImageSource = MapboxWeb.ImageSource;

// Export style URL constants
export const StyleURL = MapboxWeb.StyleURL;

// Export UserTrackingMode
export const UserTrackingMode = MapboxWeb.UserTrackingMode;

// Export setAccessToken
export const setAccessToken = MapboxWeb.setAccessToken;

// Default export matching Mapbox structure with all properties
const MapboxExports = {
  ...MapboxWeb.default,
  MapView,
  Camera,
  PointAnnotation,
  UserLocation,
  MarkerView,
  ShapeSource,
  SymbolLayer,
  CircleLayer,
  LineLayer,
  FillLayer,
  Images,
  Callout,
  RasterLayer,
  RasterSource,
  ImageSource,
  StyleURL,
  UserTrackingMode,
  setAccessToken,
};

export default MapboxExports;
