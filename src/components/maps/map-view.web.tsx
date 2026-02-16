/**
 * Web implementation of map components using mapbox-gl
 * This file is used on web and Electron platforms
 */
import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
// @ts-ignore - react-dom/client types may not be available
import { createRoot } from 'react-dom/client';

import { Env } from '@/lib/env';

// Set the access token globally
mapboxgl.accessToken = Env.UNIT_MAPBOX_PUBKEY;

// Context to share map instance with child components
export const MapContext = React.createContext<any | null>(null);

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
export const UserTrackingMode = {
  Follow: 'follow',
  FollowWithHeading: 'followWithHeading',
  FollowWithCourse: 'followWithCourse',
};

// Access token setter for compatibility
export const setAccessToken = (token: string) => {
  mapboxgl.accessToken = token;
};

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
        // mapbox-gl's internal mouse event handlers (mouseout, mousemove, etc.)
        // call map.unproject() which throws "Invalid LngLat object: (NaN, NaN)"
        // when the canvas/transform is in an invalid state (zero-size, mid-resize).
        // These DOM events fire synchronously and can't be caught by error events
        // or the _render patch below.
        const origUnproject = newMap.unproject.bind(newMap);
        newMap.unproject = (point: unknown) => {
          try {
            return origUnproject(point);
          } catch {
            // Return a safe fallback LngLat (0,0) instead of crashing
            return new mapboxgl.LngLat(0, 0);
          }
        };

        // Patch easeTo / flyTo to catch "Invalid LngLat object: (NaN, NaN)"
        // errors that occur when resetNorth or other compass interactions read
        // a corrupted transform center (e.g. after resize or animation race).
        const origEaseTo = newMap.easeTo.bind(newMap);
        newMap.easeTo = function (options: any, eventData?: any) {
          try {
            return origEaseTo(options, eventData);
          } catch (e: any) {
            if (e?.message?.includes('Invalid LngLat')) {
              return this;
            }
            throw e;
          }
        };

        const origFlyTo = newMap.flyTo.bind(newMap);
        newMap.flyTo = function (options: any, eventData?: any) {
          try {
            return origFlyTo(options, eventData);
          } catch (e: any) {
            if (e?.message?.includes('Invalid LngLat')) {
              return this;
            }
            throw e;
          }
        };

        // Patch the internal _render method to gracefully handle zero-size
        // containers. mapbox-gl v3 crashes in _calcMatrices → fromInvProjectionMatrix
        // ("null is not an object evaluating r[3]") when the canvas has 0×0
        // dimensions (e.g. during route transitions or before layout completes).
        const origRender = newMap._render;
        if (typeof origRender === 'function') {
          newMap._render = function (...args: unknown[]) {
            try {
              // eslint-disable-next-line react/no-this-in-sfc
              const canvas = this.getCanvas?.();
              if (canvas && (canvas.width === 0 || canvas.height === 0)) {
                return this; // skip frame when canvas is zero-sized
              }
              return origRender.apply(this, args);
            } catch {
              // Suppress projection-matrix errors from zero-size containers
              return this;
            }
          };
        }

        // Suppress non-fatal mapbox-gl error events (e.g. "Invalid LngLat object: (NaN, NaN)")
        // that occur when mouse events fire while the map canvas is resizing.
        newMap.on('error', (e: { error?: Error }) => {
          const msg = e.error?.message ?? '';
          if (msg.includes('Invalid LngLat')) {
            return;
          }
          console.warn('[MapView.web] mapbox-gl error:', e.error);
        });
      } catch (e) {
        // mapbox-gl can throw during initialization if the container is not
        // properly laid out (e.g. zero-size canvas). We silently ignore this;
        // the map will simply not render rather than crash the app.
        console.warn('[MapView.web] Failed to initialize mapbox-gl:', e);
      }

      return () => {
        // Mark the map as removed so child components can detect it
        if (map.current) {
          (map.current as any).__removed = true;
          map.current.remove();
          map.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSize]);

    // Keep the map canvas in sync with container size changes.
    // Also do an immediate resize so the canvas matches the container
    // before any mouse events can fire (prevents NaN unproject errors).
    useEffect(() => {
      if (!map.current || !mapContainer.current) return;

      // Only resize when the container has non-zero dimensions.
      // Calling resize() with a zero-size container sets invalid dimensions
      // on mapbox's internal transform, causing _calcMatrices to crash.
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

      // Immediate resize to sync canvas with current container size
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
}

// Camera component
export const Camera = forwardRef<any, CameraProps>(({ centerCoordinate, zoomLevel, heading, pitch, animationDuration = 1000, animationMode, followUserLocation, followZoomLevel }, ref) => {
  const map = React.useContext(MapContext);
  const geolocateControl = useRef<any | null>(null);
  const hasInitialized = useRef(false);

  useImperativeHandle(ref, () => ({
    setCamera: (options: { centerCoordinate?: [number, number]; zoomLevel?: number; heading?: number; pitch?: number; animationDuration?: number }) => {
      if (!map) return;

      // Validate coordinates before passing to mapbox
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
    flyTo: (options: any) => {
      if (!map) return;

      // Validate center if provided
      if (options.center && Array.isArray(options.center) && (!isFinite(options.center[0]) || !isFinite(options.center[1]))) {
        return;
      }

      map.flyTo(options, { _programmatic: true });
    },
  }));

  useEffect(() => {
    if (!map) return;

    if (centerCoordinate && centerCoordinate.length === 2 && isFinite(centerCoordinate[0]) && isFinite(centerCoordinate[1])) {
      // Skip the first render — the MapView already initialized at the correct
      // position via initialCenter/initialZoom, so no programmatic move needed.
      if (!hasInitialized.current) {
        hasInitialized.current = true;
        return;
      }

      // For subsequent coordinate/zoom changes, animate to the new position.
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

  useEffect(() => {
    if (!map || !followUserLocation) return;

    let triggerTimeoutId: any;

    // Add geolocate control for following user
    if (!geolocateControl.current) {
      geolocateControl.current = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserHeading: true,
      });
      map.addControl(geolocateControl.current);
    }

    // Trigger tracking after control is added
    triggerTimeoutId = setTimeout(() => {
      geolocateControl.current?.trigger();
    }, 100);

    return () => {
      if (triggerTimeoutId) {
        clearTimeout(triggerTimeoutId);
      }
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
  const map = React.useContext(MapContext);
  const markerRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerRootRef = useRef<any>(null);

  // Create marker once when map/id/coordinate are available
  useEffect(() => {
    if (!map || !coordinate) return;

    // Create a container for React children
    const container = document.createElement('div');
    container.style.cursor = 'pointer';
    containerRef.current = container;

    // Create a persistent React root for rendering children
    const root = createRoot(container);
    containerRootRef.current = root;

    // Determine marker options based on anchor prop
    const markerOptions: any = {
      element: container,
    };

    // Handle anchor prop - if it's a string, use it as mapbox anchor
    if (typeof anchor === 'string') {
      markerOptions.anchor = anchor as any;
    }

    markerRef.current = new mapboxgl.Marker(markerOptions).setLngLat(coordinate).addTo(map);

    // If anchor is an {x, y} object, convert to pixel offset
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
      // Unmount React root
      if (containerRootRef.current) {
        containerRootRef.current.unmount();
        containerRootRef.current = null;
      }

      // Remove marker from map
      markerRef.current?.remove();
      markerRef.current = null;
      containerRef.current = null;
    };
    // Only recreate marker when map, id, or anchor change — NOT children
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, id]);

  // Update coordinate when values actually change (by value, not reference)
  useEffect(() => {
    if (markerRef.current && coordinate && coordinate.length === 2 && isFinite(coordinate[0]) && isFinite(coordinate[1])) {
      markerRef.current.setLngLat(coordinate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinate?.[0], coordinate?.[1]]);

  // Render children into the marker's React root whenever children identity changes.
  // Using a layout effect with [children] dep so it only fires when children actually change.
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

// UserLocation Props interface
interface UserLocationProps {
  visible?: boolean;
  showsUserHeadingIndicator?: boolean;
}

// UserLocation component - handled by GeolocateControl in Camera
export const UserLocation: React.FC<UserLocationProps> = ({ visible = true, showsUserHeadingIndicator = true }) => {
  const map = React.useContext(MapContext);

  useEffect(() => {
    if (!map || !visible) return;

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserHeading: showsUserHeadingIndicator,
    });

    map.addControl(geolocate);

    // Auto-trigger to show user location
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
          // map may already be destroyed during route transitions
        }
      };
    }

    return () => {
      try {
        map.removeControl(geolocate);
      } catch {
        // map may already be destroyed during route transitions
      }
    };
  }, [map, visible, showsUserHeadingIndicator]);

  return null;
};

// MarkerView component (simplified for web)
export const MarkerView: React.FC<{
  coordinate: [number, number];
  children?: React.ReactNode;
}> = ({ coordinate, children }) => {
  return (
    <PointAnnotation id={`marker-${coordinate.join('-')}`} coordinate={coordinate}>
      {children}
    </PointAnnotation>
  );
};

// Placeholder components for compatibility
export const ShapeSource: React.FC<any> = ({ children }) => <>{children}</>;
export const SymbolLayer: React.FC<any> = () => null;
export const CircleLayer: React.FC<any> = () => null;
export const LineLayer: React.FC<any> = () => null;
export const FillLayer: React.FC<any> = () => null;
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
  StyleURL,
  UserTrackingMode,
  setAccessToken,
};
