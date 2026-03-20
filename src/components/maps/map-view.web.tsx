/**
 * Web/Electron implementation of map components using mapbox-gl
 * This file is used on web and Electron platforms
 */
import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
// @ts-ignore - react-dom/client types may not be available
import { createRoot } from 'react-dom/client';

import { Env } from '@/lib/env';

// Set the access token globally
mapboxgl.accessToken = Env.UNIT_MAPBOX_PUBKEY;

// Context to share map instance with child components
export const MapContext = React.createContext<any | null>(null);

// Context to share source ID from source components (ShapeSource, ImageSource, RasterSource) to layer children
const SourceContext = React.createContext<string | null>(null);

// StyleURL constants matching native Mapbox SDK
export const StyleURL = {
  Street: 'mapbox://styles/mapbox/streets-v12',
  Dark: 'mapbox://styles/mapbox/dark-v11',
  Light: 'mapbox://styles/mapbox/light-v11',
  Outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  Satellite: 'mapbox://styles/mapbox/satellite-v9',
  SatelliteStreet: 'mapbox://styles/mapbox/satellite-streets-v12',
};

// UserTrackingMode enum matching native SDK
export enum UserTrackingMode {
  Follow = 'normal',
  FollowWithHeading = 'compass',
  FollowWithCourse = 'course',
}

// Access token setter for compatibility
export const setAccessToken = (token: string) => {
  mapboxgl.accessToken = token;
};

// --- Style conversion helpers ---

function toLinePaint(style: any) {
  const p: Record<string, any> = {};
  if (style?.lineColor !== undefined) p['line-color'] = style.lineColor;
  if (style?.lineWidth !== undefined) p['line-width'] = style.lineWidth;
  if (style?.lineOpacity !== undefined) p['line-opacity'] = style.lineOpacity;
  if (style?.lineDasharray !== undefined) p['line-dasharray'] = style.lineDasharray;
  if (style?.lineBlur !== undefined) p['line-blur'] = style.lineBlur;
  if (style?.lineOffset !== undefined) p['line-offset'] = style.lineOffset;
  return p;
}

function toLineLayout(style: any) {
  const l: Record<string, any> = {};
  if (style?.lineCap !== undefined) l['line-cap'] = style.lineCap;
  if (style?.lineJoin !== undefined) l['line-join'] = style.lineJoin;
  return l;
}

function toFillPaint(style: any) {
  const p: Record<string, any> = {};
  if (style?.fillColor !== undefined) p['fill-color'] = style.fillColor;
  if (style?.fillOpacity !== undefined) p['fill-opacity'] = style.fillOpacity;
  if (style?.fillOutlineColor !== undefined) p['fill-outline-color'] = style.fillOutlineColor;
  if (style?.fillPattern !== undefined) p['fill-pattern'] = style.fillPattern;
  return p;
}

function toCirclePaint(style: any) {
  const p: Record<string, any> = {};
  if (style?.circleRadius !== undefined) p['circle-radius'] = style.circleRadius;
  if (style?.circleColor !== undefined) p['circle-color'] = style.circleColor;
  if (style?.circleOpacity !== undefined) p['circle-opacity'] = style.circleOpacity;
  if (style?.circleStrokeColor !== undefined) p['circle-stroke-color'] = style.circleStrokeColor;
  if (style?.circleStrokeWidth !== undefined) p['circle-stroke-width'] = style.circleStrokeWidth;
  if (style?.circleStrokeOpacity !== undefined) p['circle-stroke-opacity'] = style.circleStrokeOpacity;
  if (style?.circleBlur !== undefined) p['circle-blur'] = style.circleBlur;
  return p;
}

function toSymbolPaint(style: any) {
  const p: Record<string, any> = {};
  if (style?.textColor !== undefined) p['text-color'] = style.textColor;
  if (style?.textHaloColor !== undefined) p['text-halo-color'] = style.textHaloColor;
  if (style?.textHaloWidth !== undefined) p['text-halo-width'] = style.textHaloWidth;
  if (style?.textOpacity !== undefined) p['text-opacity'] = style.textOpacity;
  if (style?.iconColor !== undefined) p['icon-color'] = style.iconColor;
  if (style?.iconOpacity !== undefined) p['icon-opacity'] = style.iconOpacity;
  return p;
}

function toSymbolLayout(style: any) {
  const l: Record<string, any> = {};
  if (style?.textField !== undefined) l['text-field'] = style.textField;
  if (style?.textSize !== undefined) l['text-size'] = style.textSize;
  if (style?.textFont !== undefined) l['text-font'] = style.textFont;
  if (style?.textOffset !== undefined) l['text-offset'] = style.textOffset;
  if (style?.textAnchor !== undefined) l['text-anchor'] = style.textAnchor;
  if (style?.textAllowOverlap !== undefined) l['text-allow-overlap'] = style.textAllowOverlap;
  if (style?.textIgnorePlacement !== undefined) l['text-ignore-placement'] = style.textIgnorePlacement;
  if (style?.textMaxWidth !== undefined) l['text-max-width'] = style.textMaxWidth;
  if (style?.iconImage !== undefined) l['icon-image'] = style.iconImage;
  if (style?.iconSize !== undefined) l['icon-size'] = style.iconSize;
  if (style?.iconAnchor !== undefined) l['icon-anchor'] = style.iconAnchor;
  if (style?.iconOffset !== undefined) l['icon-offset'] = style.iconOffset;
  if (style?.iconAllowOverlap !== undefined) l['icon-allow-overlap'] = style.iconAllowOverlap;
  if (style?.symbolPlacement !== undefined) l['symbol-placement'] = style.symbolPlacement;
  if (style?.symbolSpacing !== undefined) l['symbol-spacing'] = style.symbolSpacing;
  return l;
}

function toRasterPaint(style: any) {
  const p: Record<string, any> = {};
  if (style?.rasterOpacity !== undefined) p['raster-opacity'] = style.rasterOpacity;
  if (style?.rasterFadeDuration !== undefined) p['raster-fade-duration'] = style.rasterFadeDuration;
  if (style?.rasterBrightnessMin !== undefined) p['raster-brightness-min'] = style.rasterBrightnessMin;
  if (style?.rasterBrightnessMax !== undefined) p['raster-brightness-max'] = style.rasterBrightnessMax;
  if (style?.rasterSaturation !== undefined) p['raster-saturation'] = style.rasterSaturation;
  if (style?.rasterContrast !== undefined) p['raster-contrast'] = style.rasterContrast;
  return p;
}

// Safe layer/source removal helpers
function safeRemoveLayer(map: any, id: string) {
  try {
    if (map && !map.__removed && map.getLayer(id)) map.removeLayer(id);
  } catch {
    /* ignore */
  }
}

function safeRemoveSource(map: any, id: string) {
  try {
    if (map && !map.__removed && map.getSource(id)) map.removeSource(id);
  } catch {
    /* ignore */
  }
}

// MapView Props interface
interface MapViewProps {
  style?: React.CSSProperties;
  styleURL?: string;
  onDidFinishLoadingMap?: () => void;
  onCameraChanged?: (event: { properties: { isUserInteraction: boolean } }) => void;
  children?: React.ReactNode;
  testID?: string;
  logoEnabled?: boolean;
  attributionEnabled?: boolean;
  compassEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  scrollEnabled?: boolean;
  pitchEnabled?: boolean;
  /** Initial center [lng, lat] passed to the map constructor so it starts at the right place */
  initialCenter?: [number, number];
  /** Initial zoom level passed to the map constructor */
  initialZoom?: number;
}

// MapView component
export const MapView = forwardRef<any, MapViewProps>(
  (
    {
      style,
      styleURL = StyleURL.Street,
      onDidFinishLoadingMap,
      onCameraChanged,
      children,
      testID,
      logoEnabled = false,
      attributionEnabled = false,
      compassEnabled = true,
      zoomEnabled = true,
      rotateEnabled = true,
      scrollEnabled = true,
      pitchEnabled = true,
      initialCenter,
      initialZoom,
    },
    ref
  ) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasSize, setHasSize] = useState(false);

    useImperativeHandle(ref, () => ({
      getMap: () => map.current,
    }));

    // Wait until the container has non-zero dimensions before initializing mapbox-gl.
    // Mapbox crashes with "null is not an object (evaluating 'r[3]')" in its
    // projection-matrix code when the container has 0×0 size.
    useEffect(() => {
      const el = mapContainer.current;
      if (!el) return;

      const check = () => {
        if (el.clientWidth > 0 && el.clientHeight > 0) {
          setHasSize(true);
          return true;
        }
        return false;
      };

      // Already has size (common path)
      if (check()) return;

      // Watch for layout via ResizeObserver
      const ro = new ResizeObserver(() => {
        if (check()) {
          ro.disconnect();
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      if (!hasSize || map.current || !mapContainer.current) return;

      // Double-check the container actually has layout dimensions.
      // mapbox-gl's projection matrix code will throw if the canvas is 0×0.
      const { clientWidth, clientHeight } = mapContainer.current;
      if (clientWidth === 0 || clientHeight === 0) return;

      try {
        // Use initialCenter/initialZoom if provided so the map starts at the
        // correct position without needing a programmatic camera move later.
        const startCenter = initialCenter && isFinite(initialCenter[0]) && isFinite(initialCenter[1]) ? initialCenter : ([-98.5795, 39.8283] as [number, number]); // Default US center
        const startZoom = initialZoom != null && isFinite(initialZoom) ? initialZoom : 4;

        const newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: styleURL,
          center: startCenter,
          zoom: startZoom,
          attributionControl: attributionEnabled,
          logoPosition: logoEnabled ? 'bottom-left' : undefined,
          dragRotate: rotateEnabled,
          scrollZoom: zoomEnabled,
          dragPan: scrollEnabled,
          pitchWithRotate: pitchEnabled,
        });

        if (!logoEnabled) {
          // Hide logo via CSS if not enabled
          newMap.on('load', () => {
            const logoEl = mapContainer.current?.querySelector('.mapboxgl-ctrl-logo');
            if (logoEl) {
              (logoEl as HTMLElement).style.display = 'none';
            }
          });
        }

        if (compassEnabled) {
          newMap.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: false }), 'top-right');
        }

        newMap.on('load', () => {
          setIsLoaded(true);
          onDidFinishLoadingMap?.();
        });

        newMap.on('moveend', (e: any) => {
          // mapbox-gl propagates eventData from easeTo/flyTo into the event object.
          // We tag all programmatic camera moves with { _programmatic: true } so the
          // moveend handler can distinguish them from real user interactions.
          const wasUser = !e._programmatic;
          onCameraChanged?.({ properties: { isUserInteraction: wasUser } });
        });

        map.current = newMap;

        // Patch unproject to gracefully handle NaN results.
        const origUnproject = newMap.unproject.bind(newMap);
        newMap.unproject = (point: unknown) => {
          try {
            return origUnproject(point);
          } catch {
            return new mapboxgl.LngLat(0, 0);
          }
        };

        // Patch easeTo / flyTo to catch "Invalid LngLat object: (NaN, NaN)" errors
        const origEaseTo = newMap.easeTo.bind(newMap);
        newMap.easeTo = function (options: any, eventData?: any) {
          try {
            return origEaseTo(options, eventData);
          } catch (e: any) {
            if (e?.message?.includes('Invalid LngLat')) return this;
            throw e;
          }
        };

        const origFlyTo = newMap.flyTo.bind(newMap);
        newMap.flyTo = function (options: any, eventData?: any) {
          try {
            return origFlyTo(options, eventData);
          } catch (e: any) {
            if (e?.message?.includes('Invalid LngLat')) return this;
            throw e;
          }
        };

        // Patch the internal _render method to gracefully handle zero-size containers.
        const origRender = newMap._render;
        if (typeof origRender === 'function') {
          newMap._render = function (...args: unknown[]) {
            try {
              // eslint-disable-next-line react/no-this-in-sfc
              const canvas = this.getCanvas?.();
              if (canvas && (canvas.width === 0 || canvas.height === 0)) {
                return this;
              }
              return origRender.apply(this, args);
            } catch {
              return this;
            }
          };
        }

        // Suppress non-fatal mapbox-gl error events
        newMap.on('error', (e: { error?: Error }) => {
          const msg = e.error?.message ?? '';
          if (msg.includes('Invalid LngLat')) return;
          console.warn('[MapView.web] mapbox-gl error:', e.error);
        });
      } catch (e) {
        console.warn('[MapView.web] Failed to initialize mapbox-gl:', e);
      }

      return () => {
        if (map.current) {
          (map.current as any).__removed = true;
          map.current.remove();
          map.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSize]);

    // Keep the map canvas in sync with container size changes.
    useEffect(() => {
      if (!map.current || !mapContainer.current) return;

      const safeResize = () => {
        const el = mapContainer.current;
        if (el && el.clientWidth > 0 && el.clientHeight > 0) {
          try {
            map.current?.resize();
          } catch {
            // ignore resize errors during teardown
          }
        }
      };

      safeResize();

      const ro = new ResizeObserver(() => safeResize());
      ro.observe(mapContainer.current);
      return () => ro.disconnect();
    }, [isLoaded]);

    // Update style when it changes
    useEffect(() => {
      if (map.current && styleURL) {
        map.current.setStyle(styleURL);
      }
    }, [styleURL]);

    return (
      <div
        ref={mapContainer}
        data-testid={testID}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          ...style,
          // Ensure the container is never zero-height on web
          minHeight: style?.height || style?.minHeight || 100,
        }}
      >
        {isLoaded && <MapContext.Provider value={map.current}>{children}</MapContext.Provider>}
      </div>
    );
  }
);

MapView.displayName = 'MapView';

// Camera Props interface
interface CameraProps {
  ref?: React.Ref<any>;
  centerCoordinate?: [number, number];
  zoomLevel?: number;
  heading?: number;
  pitch?: number;
  animationDuration?: number;
  animationMode?: string;
  followUserLocation?: boolean;
  followUserMode?: string;
  followZoomLevel?: number;
  followPitch?: number;
  /** Fit map to bounds: {ne: [lng, lat], sw: [lng, lat]} */
  bounds?: { ne: [number, number]; sw: [number, number] };
  /** Padding for bounds fitting */
  padding?: { paddingTop?: number; paddingBottom?: number; paddingLeft?: number; paddingRight?: number };
}

// Camera component
export const Camera = forwardRef<any, CameraProps>(({ centerCoordinate, zoomLevel, heading, pitch, animationDuration = 1000, animationMode, followUserLocation, followZoomLevel, bounds, padding }, ref) => {
  const map = useContext(MapContext);
  const geolocateControl = useRef<any | null>(null);
  const hasInitialized = useRef(false);

  useImperativeHandle(ref, () => ({
    setCamera: (options: { centerCoordinate?: [number, number]; zoomLevel?: number; heading?: number; pitch?: number; animationDuration?: number }) => {
      if (!map) return;

      if (options.centerCoordinate && (!isFinite(options.centerCoordinate[0]) || !isFinite(options.centerCoordinate[1]))) {
        return;
      }

      map.easeTo(
        {
          center: options.centerCoordinate,
          zoom: options.zoomLevel,
          bearing: options.heading,
          pitch: options.pitch,
          duration: options.animationDuration || 1000,
        },
        { _programmatic: true }
      );
    },

    /** flyTo supports both array form flyTo([lng, lat], duration) and options-object form */
    flyTo: (coordinatesOrOptions: any, duration?: number) => {
      if (!map) return;

      if (Array.isArray(coordinatesOrOptions)) {
        // Native Mapbox Camera API: flyTo([lng, lat], animationDuration)
        const [lng, lat] = coordinatesOrOptions;
        if (!isFinite(lng) || !isFinite(lat)) return;
        map.flyTo({ center: [lng, lat] as [number, number], duration: duration || 1000 }, { _programmatic: true });
      } else {
        // Options-object form: flyTo({ center, zoom, ... })
        const opts = coordinatesOrOptions;
        if (opts?.center && Array.isArray(opts.center) && (!isFinite(opts.center[0]) || !isFinite(opts.center[1]))) return;
        map.flyTo(opts, { _programmatic: true });
      }
    },

    /** fitBounds(ne, sw, padding?, duration?) — matches native Mapbox Camera API */
    fitBounds: (ne: [number, number], sw: [number, number], pad?: number | number[], duration?: number) => {
      if (!map) return;

      const paddingObj = Array.isArray(pad) ? { top: pad[0] ?? 60, right: pad[1] ?? 60, bottom: pad[2] ?? 60, left: pad[3] ?? 60 } : { top: pad ?? 60, right: pad ?? 60, bottom: pad ?? 60, left: pad ?? 60 };

      try {
        map.fitBounds(
          [
            [sw[0], sw[1]],
            [ne[0], ne[1]],
          ],
          { padding: paddingObj, duration: duration || 1000 },
          { _programmatic: true }
        );
      } catch {
        // ignore projection errors
      }
    },
  }));

  // Handle bounds prop (declarative camera fitting)
  useEffect(() => {
    if (!map || !bounds) return;

    const pad = padding ? { top: padding.paddingTop ?? 40, right: padding.paddingRight ?? 40, bottom: padding.paddingBottom ?? 40, left: padding.paddingLeft ?? 40 } : { top: 40, right: 40, bottom: 40, left: 40 };

    try {
      map.fitBounds(
        [
          [bounds.sw[0], bounds.sw[1]],
          [bounds.ne[0], bounds.ne[1]],
        ],
        { padding: pad, duration: animationDuration ?? 0 },
        { _programmatic: true }
      );
    } catch {
      // ignore projection errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bounds, padding]);

  // Handle centerCoordinate / zoomLevel changes
  useEffect(() => {
    if (!map) return;

    if (centerCoordinate && centerCoordinate.length === 2 && isFinite(centerCoordinate[0]) && isFinite(centerCoordinate[1])) {
      if (!hasInitialized.current) {
        hasInitialized.current = true;
        try {
          map.jumpTo({ center: centerCoordinate as [number, number], zoom: zoomLevel, bearing: heading, pitch: pitch }, { _programmatic: true });
        } catch {
          // ignore projection errors during initialization
        }
        return;
      }

      const cameraOptions = {
        center: centerCoordinate as [number, number],
        zoom: zoomLevel,
        bearing: heading,
        pitch: pitch,
        duration: animationDuration,
      };

      try {
        if (animationMode === 'flyTo') {
          map.flyTo(cameraOptions, { _programmatic: true });
        } else {
          map.easeTo(cameraOptions, { _programmatic: true });
        }
      } catch {
        // Suppress projection-matrix errors during resize/transition
      }
    }
  }, [map, centerCoordinate, zoomLevel, heading, pitch, animationDuration, animationMode]);

  // Handle followUserLocation
  useEffect(() => {
    if (!map || !followUserLocation) return;

    let triggerTimeoutId: any;

    if (!geolocateControl.current) {
      geolocateControl.current = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      });
      map.addControl(geolocateControl.current);
    }

    triggerTimeoutId = setTimeout(() => {
      geolocateControl.current?.trigger();
    }, 100);

    return () => {
      if (triggerTimeoutId) clearTimeout(triggerTimeoutId);
      if (geolocateControl.current) {
        try {
          map.removeControl(geolocateControl.current);
        } catch {
          // map may already be destroyed during route transitions
        }
        geolocateControl.current = null;
      }
    };
  }, [map, followUserLocation, followZoomLevel]);

  return null;
});

Camera.displayName = 'Camera';

// PointAnnotation Props interface
interface PointAnnotationProps {
  id: string;
  coordinate: [number, number];
  title?: string;
  children?: React.ReactNode;
  anchor?: string | { x: number; y: number };
  onSelected?: () => void;
}

// PointAnnotation component
export const PointAnnotation: React.FC<PointAnnotationProps> = ({ id, coordinate, title, children, anchor = { x: 0.5, y: 0.5 }, onSelected }) => {
  const map = useContext(MapContext);
  const markerRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerRootRef = useRef<any>(null);

  // Create marker once when map/id are available
  useEffect(() => {
    if (!map || !coordinate) return;

    const container = document.createElement('div');
    container.style.cursor = 'pointer';
    containerRef.current = container;

    const root = createRoot(container);
    containerRootRef.current = root;

    const markerOptions: any = { element: container };

    if (typeof anchor === 'string') {
      markerOptions.anchor = anchor as any;
    }

    markerRef.current = new mapboxgl.Marker(markerOptions).setLngLat(coordinate).addTo(map);

    if (typeof anchor === 'object' && anchor !== null && 'x' in anchor && 'y' in anchor) {
      const rect = container.getBoundingClientRect();
      const xOffset = (anchor.x - 0.5) * rect.width;
      const yOffset = (anchor.y - 0.5) * rect.height;
      markerRef.current.setOffset([xOffset, yOffset]);
    }

    if (title) {
      markerRef.current.setPopup(new mapboxgl.Popup().setText(title));
    }

    return () => {
      if (containerRootRef.current) {
        containerRootRef.current.unmount();
        containerRootRef.current = null;
      }
      markerRef.current?.remove();
      markerRef.current = null;
      containerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, id]);

  // Update coordinate when it changes
  useEffect(() => {
    if (markerRef.current && coordinate && coordinate.length === 2 && isFinite(coordinate[0]) && isFinite(coordinate[1])) {
      markerRef.current.setLngLat(coordinate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinate?.[0], coordinate?.[1]]);

  // Render children into the marker's React root
  useEffect(() => {
    if (containerRootRef.current && children) {
      containerRootRef.current.render(<>{children}</>);
    }
  }, [children]);

  // Update click handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onSelected) return;

    container.addEventListener('click', onSelected);
    return () => {
      container.removeEventListener('click', onSelected);
    };
  }, [onSelected]);

  return null;
};

// UserLocation component - handled by GeolocateControl in Camera
export const UserLocation: React.FC<{ visible?: boolean; showsUserHeadingIndicator?: boolean }> = ({ visible = true, showsUserHeadingIndicator = true }) => {
  const map = useContext(MapContext);

  useEffect(() => {
    if (!map || !visible) return;

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: showsUserHeadingIndicator,
    });

    map.addControl(geolocate);

    if (map.loaded()) {
      geolocate.trigger();
    } else {
      const onMapLoad = () => {
        geolocate.trigger();
      };
      map.on('load', onMapLoad);

      return () => {
        try {
          map.off('load', onMapLoad);
          map.removeControl(geolocate);
        } catch {
          /* map may already be destroyed */
        }
      };
    }

    return () => {
      try {
        map.removeControl(geolocate);
      } catch {
        /* map may already be destroyed */
      }
    };
  }, [map, visible, showsUserHeadingIndicator]);

  return null;
};

// MarkerView component
export const MarkerView: React.FC<{ coordinate: [number, number]; children?: React.ReactNode }> = ({ coordinate, children }) => {
  return (
    <PointAnnotation id={`marker-${coordinate.join('-')}`} coordinate={coordinate}>
      {children}
    </PointAnnotation>
  );
};

// --- Source components ---

interface ShapeSourceProps {
  id: string;
  shape?: GeoJSON.GeoJSON | null;
  children?: React.ReactNode;
  onPress?: (event: { features: any[] }) => void;
}

/**
 * ShapeSource — adds a GeoJSON source to the map and provides its ID to child layers via SourceContext.
 * Layers (LineLayer, FillLayer, etc.) wait for sourceReady before adding themselves.
 */
export const ShapeSource: React.FC<ShapeSourceProps> = ({ id, shape, children, onPress }) => {
  const map = useContext(MapContext);
  const [sourceReady, setSourceReady] = useState(false);
  // Use a ref so the click handler always sees the latest onPress without re-registering
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  // Add/update GeoJSON source
  useEffect(() => {
    if (!map) return;

    const data: GeoJSON.GeoJSON = shape || { type: 'FeatureCollection', features: [] };

    try {
      if (map.getSource(id)) {
        (map.getSource(id) as any).setData(data);
      } else {
        map.addSource(id, { type: 'geojson', data });
      }
      setSourceReady(true);
    } catch (e) {
      console.warn('[ShapeSource] Failed to add source:', id, e);
    }

    return () => {
      setSourceReady(false);
      // Defer source removal so child layer cleanups run first
      setTimeout(() => safeRemoveSource(map, id), 0);
    };
  }, [map, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update source data when shape changes (without removing/re-adding source)
  useEffect(() => {
    if (!map || !sourceReady) return;
    try {
      const src = map.getSource(id) as any;
      if (src) src.setData(shape || { type: 'FeatureCollection', features: [] });
    } catch {
      /* ignore */
    }
  }, [map, id, shape, sourceReady]);

  // Feature click handler — queries rendered features from this source
  useEffect(() => {
    if (!map || !onPress) return;

    const handleClick = (e: any) => {
      if (!onPressRef.current) return;
      const pt = e.point;
      const bbox: [[number, number], [number, number]] = [
        [pt.x - 8, pt.y - 8],
        [pt.x + 8, pt.y + 8],
      ];
      try {
        const features = map.queryRenderedFeatures(bbox).filter((f: any) => f.source === id);
        if (features.length > 0) onPressRef.current({ features });
      } catch {
        /* ignore */
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, id, onPress]);

  return <SourceContext.Provider value={sourceReady ? id : null}>{children}</SourceContext.Provider>;
};

interface ImageSourceProps {
  id: string;
  url: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  children?: React.ReactNode;
}

/**
 * ImageSource — overlays a georeferenced image on the map.
 * Coordinates: [NW, NE, SE, SW] as [lng, lat] pairs.
 */
export const ImageSource: React.FC<ImageSourceProps> = ({ id, url, coordinates, children }) => {
  const map = useContext(MapContext);
  const [sourceReady, setSourceReady] = useState(false);

  useEffect(() => {
    if (!map || !url) return;

    try {
      if (map.getSource(id)) {
        (map.getSource(id) as any).updateImage({ url, coordinates });
      } else {
        map.addSource(id, { type: 'image', url, coordinates });
      }
      setSourceReady(true);
    } catch (e) {
      console.warn('[ImageSource] Failed to add source:', id, e);
    }

    return () => {
      setSourceReady(false);
      setTimeout(() => safeRemoveSource(map, id), 0);
    };
  }, [map, id, url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update coordinates if they change
  useEffect(() => {
    if (!map || !sourceReady) return;
    try {
      (map.getSource(id) as any)?.updateImage({ url, coordinates });
    } catch {
      /* ignore */
    }
  }, [map, id, url, coordinates, sourceReady]);

  return <SourceContext.Provider value={sourceReady ? id : null}>{children}</SourceContext.Provider>;
};

interface RasterSourceProps {
  id: string;
  tileUrlTemplates?: string[];
  tileSize?: number;
  children?: React.ReactNode;
}

/**
 * RasterSource — adds a raster tile source to the map.
 */
export const RasterSource: React.FC<RasterSourceProps> = ({ id, tileUrlTemplates, tileSize = 256, children }) => {
  const map = useContext(MapContext);
  const [sourceReady, setSourceReady] = useState(false);

  useEffect(() => {
    if (!map || !tileUrlTemplates?.length) return;

    try {
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'raster', tiles: tileUrlTemplates, tileSize });
      }
      setSourceReady(true);
    } catch (e) {
      console.warn('[RasterSource] Failed to add source:', id, e);
    }

    return () => {
      setSourceReady(false);
      setTimeout(() => safeRemoveSource(map, id), 0);
    };
  }, [map, id, tileUrlTemplates, tileSize]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SourceContext.Provider value={sourceReady ? id : null}>{children}</SourceContext.Provider>;
};

// --- Layer components ---

interface LayerProps {
  id: string;
  style?: any;
}

/**
 * LineLayer — renders line geometry from the parent ShapeSource.
 */
export const LineLayer: React.FC<LayerProps> = ({ id, style }) => {
  const map = useContext(MapContext);
  const sourceId = useContext(SourceContext); // null until source is ready

  useEffect(() => {
    if (!map || !sourceId) return;

    if (!map.getLayer(id)) {
      try {
        map.addLayer({ id, type: 'line', source: sourceId, paint: toLinePaint(style), layout: toLineLayout(style) });
      } catch (e) {
        console.warn('[LineLayer] Failed to add layer:', id, e);
      }
    }

    return () => safeRemoveLayer(map, id);
  }, [map, sourceId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update paint when style changes
  useEffect(() => {
    if (!map || !sourceId || !map.getLayer(id)) return;
    try {
      const paint = toLinePaint(style);
      Object.entries(paint).forEach(([key, val]) => map.setPaintProperty(id, key, val));
      const layout = toLineLayout(style);
      Object.entries(layout).forEach(([key, val]) => map.setLayoutProperty(id, key, val));
    } catch {
      /* ignore */
    }
  }, [map, sourceId, id, style]);

  return null;
};

/**
 * FillLayer — renders fill/polygon geometry from the parent ShapeSource.
 */
export const FillLayer: React.FC<LayerProps> = ({ id, style }) => {
  const map = useContext(MapContext);
  const sourceId = useContext(SourceContext);

  useEffect(() => {
    if (!map || !sourceId) return;

    if (!map.getLayer(id)) {
      try {
        map.addLayer({ id, type: 'fill', source: sourceId, paint: toFillPaint(style) });
      } catch (e) {
        console.warn('[FillLayer] Failed to add layer:', id, e);
      }
    }

    return () => safeRemoveLayer(map, id);
  }, [map, sourceId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || !sourceId || !map.getLayer(id)) return;
    try {
      const paint = toFillPaint(style);
      Object.entries(paint).forEach(([key, val]) => map.setPaintProperty(id, key, val));
    } catch {
      /* ignore */
    }
  }, [map, sourceId, id, style]);

  return null;
};

/**
 * CircleLayer — renders point geometry as circles from the parent ShapeSource.
 */
export const CircleLayer: React.FC<LayerProps> = ({ id, style }) => {
  const map = useContext(MapContext);
  const sourceId = useContext(SourceContext);

  useEffect(() => {
    if (!map || !sourceId) return;

    if (!map.getLayer(id)) {
      try {
        map.addLayer({ id, type: 'circle', source: sourceId, paint: toCirclePaint(style) });
      } catch (e) {
        console.warn('[CircleLayer] Failed to add layer:', id, e);
      }
    }

    return () => safeRemoveLayer(map, id);
  }, [map, sourceId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || !sourceId || !map.getLayer(id)) return;
    try {
      const paint = toCirclePaint(style);
      Object.entries(paint).forEach(([key, val]) => map.setPaintProperty(id, key, val));
    } catch {
      /* ignore */
    }
  }, [map, sourceId, id, style]);

  return null;
};

/**
 * SymbolLayer — renders labels and icons from the parent ShapeSource.
 */
export const SymbolLayer: React.FC<LayerProps> = ({ id, style }) => {
  const map = useContext(MapContext);
  const sourceId = useContext(SourceContext);

  useEffect(() => {
    if (!map || !sourceId) return;

    if (!map.getLayer(id)) {
      try {
        map.addLayer({ id, type: 'symbol', source: sourceId, paint: toSymbolPaint(style), layout: toSymbolLayout(style) });
      } catch (e) {
        console.warn('[SymbolLayer] Failed to add layer:', id, e);
      }
    }

    return () => safeRemoveLayer(map, id);
  }, [map, sourceId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || !sourceId || !map.getLayer(id)) return;
    try {
      const paint = toSymbolPaint(style);
      Object.entries(paint).forEach(([key, val]) => map.setPaintProperty(id, key, val));
      const layout = toSymbolLayout(style);
      Object.entries(layout).forEach(([key, val]) => map.setLayoutProperty(id, key, val));
    } catch {
      /* ignore */
    }
  }, [map, sourceId, id, style]);

  return null;
};

/**
 * RasterLayer — renders raster tiles or image overlays from the parent ImageSource/RasterSource.
 */
export const RasterLayer: React.FC<LayerProps> = ({ id, style }) => {
  const map = useContext(MapContext);
  const sourceId = useContext(SourceContext);

  useEffect(() => {
    if (!map || !sourceId) return;

    if (!map.getLayer(id)) {
      try {
        map.addLayer({ id, type: 'raster', source: sourceId, paint: toRasterPaint(style) });
      } catch (e) {
        console.warn('[RasterLayer] Failed to add layer:', id, e);
      }
    }

    return () => safeRemoveLayer(map, id);
  }, [map, sourceId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || !sourceId || !map.getLayer(id)) return;
    try {
      const paint = toRasterPaint(style);
      Object.entries(paint).forEach(([key, val]) => map.setPaintProperty(id, key, val));
    } catch {
      /* ignore */
    }
  }, [map, sourceId, id, style]);

  return null;
};

// Passthrough / no-op components for API compatibility
export const Images: React.FC<any> = () => null;
export const Callout: React.FC<any> = ({ children }) => <>{children}</>;

// Default export matching native structure
export default {
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
