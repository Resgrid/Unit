/**
 * Platform-aware map components
 * Automatically selects native (@rnmapbox/maps) or web (mapbox-gl) implementation
 */
import { Platform } from 'react-native';

import * as MapboxNative from './map-view.native';
import * as MapboxWeb from './map-view.web';

// Import the platform-specific implementation
// Metro bundler will resolve to the correct file based on platform
const MapboxImpl = Platform.OS === 'web' ? MapboxWeb.default : MapboxNative.default;

// Re-export all components
export const MapView = MapboxImpl.MapView || MapboxImpl;
export const Camera = Platform.OS === 'web' ? MapboxWeb.Camera : MapboxNative.Camera;
export const PointAnnotation = Platform.OS === 'web' ? MapboxWeb.PointAnnotation : MapboxNative.PointAnnotation;
export const UserLocation = Platform.OS === 'web' ? MapboxWeb.UserLocation : MapboxNative.UserLocation;
export const MarkerView = Platform.OS === 'web' ? MapboxWeb.MarkerView : MapboxNative.MarkerView;
export const ShapeSource = Platform.OS === 'web' ? MapboxWeb.ShapeSource : MapboxNative.ShapeSource;
export const SymbolLayer = Platform.OS === 'web' ? MapboxWeb.SymbolLayer : MapboxNative.SymbolLayer;
export const CircleLayer = Platform.OS === 'web' ? MapboxWeb.CircleLayer : MapboxNative.CircleLayer;
export const LineLayer = Platform.OS === 'web' ? MapboxWeb.LineLayer : MapboxNative.LineLayer;
export const FillLayer = Platform.OS === 'web' ? MapboxWeb.FillLayer : MapboxNative.FillLayer;
export const Images = Platform.OS === 'web' ? MapboxWeb.Images : MapboxNative.Images;
export const Callout = Platform.OS === 'web' ? MapboxWeb.Callout : MapboxNative.Callout;

// Export style URL constants
export const StyleURL = Platform.OS === 'web' ? MapboxWeb.StyleURL : MapboxNative.StyleURL;

// Export UserTrackingMode
export const UserTrackingMode = Platform.OS === 'web' ? MapboxWeb.UserTrackingMode : MapboxNative.UserTrackingMode;

// Export setAccessToken
export const setAccessToken = Platform.OS === 'web' ? MapboxWeb.setAccessToken : MapboxNative.setAccessToken;

// Default export matching Mapbox structure with all properties
const Mapbox = {
  ...MapboxImpl,
  MapView: MapView,
  Camera: Camera,
  PointAnnotation: PointAnnotation,
  UserLocation: UserLocation,
  MarkerView: MarkerView,
  ShapeSource: ShapeSource,
  SymbolLayer: SymbolLayer,
  CircleLayer: CircleLayer,
  LineLayer: LineLayer,
  FillLayer: FillLayer,
  Images: Images,
  Callout: Callout,
  StyleURL: StyleURL,
  UserTrackingMode: UserTrackingMode,
  setAccessToken: setAccessToken,
};

export default Mapbox;
