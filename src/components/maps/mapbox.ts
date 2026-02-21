/**
 * TypeScript type resolution shim for platform-specific Mapbox implementations.
 * Metro resolves mapbox.native.ts on iOS/Android and mapbox.web.ts on web,
 * but TypeScript needs a base file to satisfy module resolution.
 * This file re-exports from the native implementation so types are available.
 */
export { Callout, Camera, CircleLayer, FillLayer, Images, LineLayer, MapView, MarkerView, PointAnnotation, setAccessToken, ShapeSource, StyleURL, SymbolLayer, UserLocation, UserTrackingMode } from './mapbox.native';
export { default } from './mapbox.native';
