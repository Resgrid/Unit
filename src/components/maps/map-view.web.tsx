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
import { getDepartmentMapCenter } from '@/lib/map-center';

// Set the access token globally
mapboxgl.accessToken = Env.UNIT_MAPBOX_PUBKEY;

// Context to share map instance with child components
export const MapContext = React.createContext<any | null>(null);

// Context to share source ID from source components (ShapeSource, ImageSource, RasterSource) to layer children
const SourceContext = React.createContext<string | null>(null);

// mapbox-gl's setStyle() replaces the whole style document, dropping every
// custom image, source and layer that was added on top of it. This counter is
// bumped on each 'style.load' so the add-effects below re-run and re-register
// their content after a theme swap (otherwise the unit dot, heading arrow,
// accuracy circle, route lines and geofence vanish until the map remounts).
const StyleGenerationContext = React.createContext<number>(0);

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
  if (style?.iconIgnorePlacement !== undefined) l['icon-ignore-placement'] = style.iconIgnorePlacement;
  if (style?.iconRotate !== undefined) l['icon-rotate'] = style.iconRotate;
  if (style?.iconRotationAlignment !== undefined) l['icon-rotation-alignment'] = style.iconRotationAlignment;
  if (style?.iconPitchAlignment !== undefined) l['icon-pitch-alignment'] = style.iconPitchAlignment;
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
    // Bumped on every 'style.load' so children re-add their images/sources/layers
    // after a theme swap wipes them (see StyleGenerationContext).
    const [styleGeneration, setStyleGeneration] = useState(0);

    // The map is created once (deps: [hasSize]), so the 'moveend' handler would
    // otherwise capture the first onCameraChanged forever. On the home map that
    // callback is recreated per isMapLocked — which is MMKV-persisted — so a
    // session booting locked kept a stale isMapLocked=true closure and never
    // recorded user pans after unlocking. Read the latest prop through a ref.
    const onCameraChangedRef = useRef(onCameraChanged);
    onCameraChangedRef.current = onCameraChanged;

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
        const startCenter = initialCenter && isFinite(initialCenter[0]) && isFinite(initialCenter[1]) ? initialCenter : ([getDepartmentMapCenter().longitude, getDepartmentMapCenter().latitude] as [number, number]); // Default US center
        const startZoom = initialZoom != null && isFinite(initialZoom) ? initialZoom : 4;

        const newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: styleURL,
          center: startCenter,
          zoom: startZoom,
          // v12 styles (Mapbox Standard) default to globe projection in GL JS v3.
          // Globe ray-casting crashes on clicks where the ray misses the sphere
          // ("Cannot read properties of undefined (reading '0')" in coordinateLocation).
          // Mercator also matches the native SDK rendering.
          projection: 'mercator',
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
          // Style JSON (e.g. streets-v12) may re-apply globe projection on load,
          // overriding the constructor option. Re-assert mercator.
          try {
            newMap.setProjection({ name: 'mercator' });
          } catch {
            // ignore — older mapbox-gl versions
          }
          setIsLoaded(true);
          onDidFinishLoadingMap?.();
        });

        newMap.on('moveend', (e: any) => {
          // mapbox-gl propagates eventData from easeTo/flyTo into the event object.
          // We tag all programmatic camera moves with { _programmatic: true } so the
          // moveend handler can distinguish them from real user interactions.
          const wasUser = !e._programmatic;
          onCameraChangedRef.current?.({ properties: { isUserInteraction: wasUser } });
        });

        // setStyle() drops every custom image/source/layer — tell the children to
        // re-add theirs once the new style document is in place.
        newMap.on('style.load', () => {
          setStyleGeneration((generation) => generation + 1);
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

        // Patch the internal _updateProjection method — globe ray-casting can
        // return undefined for clicks where the ray misses the sphere, crashing
        // coordinateLocation with "Cannot read properties of undefined (reading '0')".
        const origUpdateProjection = newMap._updateProjection;
        if (typeof origUpdateProjection === 'function') {
          newMap._updateProjection = function (...args: unknown[]) {
            try {
              return origUpdateProjection.apply(this, args);
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

    // Gesture handlers are set at construction, so prop changes (e.g. the home
    // map's scrollEnabled={!isMapLocked}) never reached the map — locking the
    // map left every gesture live on web. Keep the handlers in sync.
    useEffect(() => {
      const instance = map.current;
      if (!instance || instance.__removed) return;

      const applyHandler = (handler: any, enabled: boolean) => {
        try {
          if (enabled) {
            handler?.enable();
          } else {
            handler?.disable();
          }
        } catch {
          /* handler may not exist on older mapbox-gl builds */
        }
      };

      applyHandler(instance.dragPan, scrollEnabled);
      applyHandler(instance.scrollZoom, zoomEnabled);
      applyHandler(instance.doubleClickZoom, zoomEnabled);
      applyHandler(instance.dragRotate, rotateEnabled);
      // Touch pinch drives both zoom and rotate; keep it live only while at
      // least one of them is allowed.
      applyHandler(instance.touchZoomRotate, zoomEnabled || rotateEnabled);
      // pitchWithRotate is a dragRotate option rather than its own handler.
      try {
        if (instance.dragRotate && '_pitchWithRotate' in instance.dragRotate) {
          instance.dragRotate._pitchWithRotate = pitchEnabled;
        }
      } catch {
        /* ignore — option is private and may move between mapbox-gl versions */
      }
    }, [isLoaded, scrollEnabled, zoomEnabled, rotateEnabled, pitchEnabled]);

    // Update style when it changes
    useEffect(() => {
      if (map.current && styleURL) {
        map.current.setStyle(styleURL);
        // Style JSON may re-apply globe projection — keep mercator.
        map.current.once('style.load', () => {
          try {
            map.current?.setProjection({ name: 'mercator' });
          } catch {
            // ignore
          }
        });
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
        {isLoaded ? (
          <MapContext.Provider value={map.current}>
            <StyleGenerationContext.Provider value={styleGeneration}>{children}</StyleGenerationContext.Provider>
          </MapContext.Provider>
        ) : null}
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
  /** Initial camera placement, matching the native Camera prop of the same name. */
  defaultSettings?: { centerCoordinate?: [number, number]; zoomLevel?: number; heading?: number; pitch?: number };
}

// Camera component
export const Camera = forwardRef<any, CameraProps>(
  ({ centerCoordinate, zoomLevel, heading, pitch, animationDuration = 1000, animationMode, followUserLocation, followZoomLevel, bounds, padding, defaultSettings }, ref) => {
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

    // Honor defaultSettings for the very first placement, matching the native
    // Camera. Without this the web map booted at the department center / zoom 4
    // and only then animated to the unit.
    useEffect(() => {
      if (!map || hasInitialized.current || !defaultSettings) return;

      const center = defaultSettings.centerCoordinate;
      if (!center || center.length !== 2 || !isFinite(center[0]) || !isFinite(center[1])) return;

      hasInitialized.current = true;
      try {
        map.jumpTo({ center: center as [number, number], zoom: defaultSettings.zoomLevel, bearing: defaultSettings.heading, pitch: defaultSettings.pitch }, { _programmatic: true });
      } catch {
        // ignore projection errors during initialization
      }
      // Initial placement only — later moves go through setCamera/centerCoordinate.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

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
  }
);

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

/**
 * Native anchors are fractional {x, y} offsets into the marker box; mapbox-gl
 * takes a named anchor instead. Measuring the element to convert (the previous
 * approach) always read 0×0 because the React root has not rendered yet when
 * the marker is created, so every pin ended up centered on its coordinate.
 */
function toMarkerAnchor(anchor: string | { x: number; y: number } | undefined): string {
  if (typeof anchor === 'string') return anchor;
  if (!anchor || typeof anchor.x !== 'number' || typeof anchor.y !== 'number') return 'center';

  const vertical = anchor.y >= 0.75 ? 'bottom' : anchor.y <= 0.25 ? 'top' : '';
  const horizontal = anchor.x >= 0.75 ? 'right' : anchor.x <= 0.25 ? 'left' : '';

  if (vertical && horizontal) return `${vertical}-${horizontal}`;
  return vertical || horizontal || 'center';
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

    const markerOptions: any = { element: container, anchor: toMarkerAnchor(anchor) };

    markerRef.current = new mapboxgl.Marker(markerOptions).setLngLat(coordinate).addTo(map);

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
// A stable `id` keeps the underlying mapbox-gl Marker alive across coordinate
// updates; without one the id is derived from the coordinate, so every location
// change tears down and recreates the DOM marker.
export const MarkerView: React.FC<{ id?: string; coordinate: [number, number]; children?: React.ReactNode; anchor?: { x: number; y: number }; allowOverlap?: boolean }> = ({ id, coordinate, children, anchor }) => {
  return (
    <PointAnnotation id={id ?? `marker-${coordinate.join('-')}`} coordinate={coordinate} anchor={anchor}>
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
  const styleGeneration = useContext(StyleGenerationContext);
  // Tracked as a generation rather than a boolean so a style swap forces the
  // source back through the "not ready" phase: child layers then unregister and
  // only re-add once the source exists again in the new style document.
  const [readyGeneration, setReadyGeneration] = useState(-1);
  const sourceReady = readyGeneration === styleGeneration;
  // Guards the deferred removal below against tearing down a source that a
  // newer add-effect (e.g. after a style swap) has already re-registered.
  const addTokenRef = useRef(0);
  // Use a ref so the click handler always sees the latest onPress without re-registering
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  // Add/update GeoJSON source
  useEffect(() => {
    if (!map) return;

    const data: GeoJSON.GeoJSON = shape || { type: 'FeatureCollection', features: [] };
    const token = ++addTokenRef.current;

    try {
      if (map.getSource(id)) {
        (map.getSource(id) as any).setData(data);
      } else {
        map.addSource(id, { type: 'geojson', data });
      }
      setReadyGeneration(styleGeneration);
    } catch (e) {
      console.warn('[ShapeSource] Failed to add source:', id, e);
    }

    return () => {
      setReadyGeneration(-1);
      // Defer source removal so child layer cleanups run first
      setTimeout(() => {
        // Reading the CURRENT token is the point: if a newer add-effect has
        // claimed this source id (e.g. after a style swap) we must not remove it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (addTokenRef.current === token) safeRemoveSource(map, id);
      }, 0);
    };
  }, [map, id, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const styleGeneration = useContext(StyleGenerationContext);
  const [readyGeneration, setReadyGeneration] = useState(-1);
  const sourceReady = readyGeneration === styleGeneration;
  const addTokenRef = useRef(0);

  useEffect(() => {
    if (!map || !url) return;

    const token = ++addTokenRef.current;

    try {
      if (map.getSource(id)) {
        (map.getSource(id) as any).updateImage({ url, coordinates });
      } else {
        map.addSource(id, { type: 'image', url, coordinates });
      }
      setReadyGeneration(styleGeneration);
    } catch (e) {
      console.warn('[ImageSource] Failed to add source:', id, e);
    }

    return () => {
      setReadyGeneration(-1);
      setTimeout(() => {
        // Reading the CURRENT token is the point: if a newer add-effect has
        // claimed this source id (e.g. after a style swap) we must not remove it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (addTokenRef.current === token) safeRemoveSource(map, id);
      }, 0);
    };
  }, [map, id, url, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const styleGeneration = useContext(StyleGenerationContext);
  const [readyGeneration, setReadyGeneration] = useState(-1);
  const sourceReady = readyGeneration === styleGeneration;
  const addTokenRef = useRef(0);

  useEffect(() => {
    if (!map || !tileUrlTemplates?.length) return;

    const token = ++addTokenRef.current;

    try {
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'raster', tiles: tileUrlTemplates, tileSize });
      }
      setReadyGeneration(styleGeneration);
    } catch (e) {
      console.warn('[RasterSource] Failed to add source:', id, e);
    }

    return () => {
      setReadyGeneration(-1);
      setTimeout(() => {
        // Reading the CURRENT token is the point: if a newer add-effect has
        // claimed this source id (e.g. after a style swap) we must not remove it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (addTokenRef.current === token) safeRemoveSource(map, id);
      }, 0);
    };
  }, [map, id, tileUrlTemplates, tileSize, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const styleGeneration = useContext(StyleGenerationContext);
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
  }, [map, sourceId, id, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const styleGeneration = useContext(StyleGenerationContext);
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
  }, [map, sourceId, id, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const styleGeneration = useContext(StyleGenerationContext);
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
  }, [map, sourceId, id, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const styleGeneration = useContext(StyleGenerationContext);
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
  }, [map, sourceId, id, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const styleGeneration = useContext(StyleGenerationContext);
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
  }, [map, sourceId, id, styleGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

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

/**
 * Images — registers named images with the map style so SymbolLayers can
 * reference them via iconImage. Values may be URI strings (including data:
 * URIs) or {uri} objects; entries that don't resolve to a string are skipped.
 */
export const Images: React.FC<{ images?: Record<string, any>; children?: React.ReactNode }> = ({ images }) => {
  const map = useContext(MapContext);
  // setStyle() drops custom images along with everything else, so re-register
  // them whenever the style document is replaced.
  const styleGeneration = useContext(StyleGenerationContext);

  useEffect(() => {
    if (!map || !images) return;

    const added: string[] = [];
    // Image decoding is async, so onload can land after this effect is cleaned
    // up. Without this flag the late add re-registered an image that the
    // cleanup had already passed over, leaking it into the style forever.
    let cancelled = false;

    Object.entries(images).forEach(([name, source]) => {
      const uri = typeof source === 'string' ? source : typeof source?.uri === 'string' ? source.uri : undefined;
      if (!uri) return;

      try {
        if (map.hasImage(name)) return;
      } catch {
        return;
      }

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (map.__removed) return;
          if (cancelled) {
            // Effect already torn down — drop anything that slipped in.
            if (map.hasImage(name)) map.removeImage(name);
            return;
          }
          if (!map.hasImage(name)) {
            map.addImage(name, img);
            added.push(name);
          }
        } catch {
          /* map may already be destroyed */
        }
      };
      img.src = uri;
    });

    return () => {
      cancelled = true;
      added.forEach((name) => {
        try {
          if (!map.__removed && map.hasImage(name)) map.removeImage(name);
        } catch {
          /* ignore */
        }
      });
    };
  }, [map, images, styleGeneration]);

  return null;
};
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
