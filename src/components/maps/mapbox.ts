/**
 * Platform-aware map components
 * Automatically selects native (@rnmapbox/maps) or web (mapbox-gl) implementation
 */
import { Platform } from 'react-native';

// Import the platform-specific implementation
// Metro bundler will resolve to the correct file based on platform
const MapboxImpl = Platform.OS === 'web' 
  ? require('./map-view.web').default 
  : require('./map-view.native').default;

// Re-export all components
export const MapView = MapboxImpl.MapView || MapboxImpl;
export const Camera = Platform.OS === 'web' 
  ? require('./map-view.web').Camera 
  : require('./map-view.native').Camera;
export const PointAnnotation = Platform.OS === 'web' 
  ? require('./map-view.web').PointAnnotation 
  : require('./map-view.native').PointAnnotation;
export const UserLocation = Platform.OS === 'web' 
  ? require('./map-view.web').UserLocation 
  : require('./map-view.native').UserLocation;
export const MarkerView = Platform.OS === 'web' 
  ? require('./map-view.web').MarkerView 
  : require('./map-view.native').MarkerView;
export const ShapeSource = Platform.OS === 'web' 
  ? require('./map-view.web').ShapeSource 
  : require('./map-view.native').ShapeSource;
export const SymbolLayer = Platform.OS === 'web' 
  ? require('./map-view.web').SymbolLayer 
  : require('./map-view.native').SymbolLayer;
export const CircleLayer = Platform.OS === 'web' 
  ? require('./map-view.web').CircleLayer 
  : require('./map-view.native').CircleLayer;
export const LineLayer = Platform.OS === 'web' 
  ? require('./map-view.web').LineLayer 
  : require('./map-view.native').LineLayer;
export const FillLayer = Platform.OS === 'web' 
  ? require('./map-view.web').FillLayer 
  : require('./map-view.native').FillLayer;
export const Images = Platform.OS === 'web' 
  ? require('./map-view.web').Images 
  : require('./map-view.native').Images;
export const Callout = Platform.OS === 'web' 
  ? require('./map-view.web').Callout 
  : require('./map-view.native').Callout;

// Export style URL constants
export const StyleURL = Platform.OS === 'web' 
  ? require('./map-view.web').StyleURL 
  : require('./map-view.native').StyleURL;

// Export UserTrackingMode
export const UserTrackingMode = Platform.OS === 'web' 
  ? require('./map-view.web').UserTrackingMode 
  : require('./map-view.native').UserTrackingMode;

// Export setAccessToken
export const setAccessToken = Platform.OS === 'web' 
  ? require('./map-view.web').setAccessToken 
  : require('./map-view.native').setAccessToken;

// Default export matching Mapbox structure
export default MapboxImpl;
