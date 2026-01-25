/**
 * Web implementation of map components using mapbox-gl
 * This file is used on web and Electron platforms
 */
import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Env } from '@/lib/env';

// Set the access token globally
mapboxgl.accessToken = Env.UNIT_MAPBOX_PUBKEY;

// Context to share map instance with child components
export const MapContext = React.createContext<mapboxgl.Map | null>(null);

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
    },
    ref
  ) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
      getMap: () => map.current,
    }));

    useEffect(() => {
      if (map.current || !mapContainer.current) return;

      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleURL,
        center: [-98.5795, 39.8283], // Default US center
        zoom: 4,
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

      newMap.on('moveend', () => {
        onCameraChanged?.({ properties: { isUserInteraction: true } });
      });

      map.current = newMap;

      return () => {
        map.current?.remove();
        map.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update style when it changes
    useEffect(() => {
      if (map.current && styleURL) {
        map.current.setStyle(styleURL);
      }
    }, [styleURL]);

    return (
      <div ref={mapContainer} data-testid={testID} style={{ width: '100%', height: '100%', ...style }}>
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
export const Camera = forwardRef<any, CameraProps>(({ centerCoordinate, zoomLevel, heading, pitch, animationDuration = 1000, followUserLocation, followZoomLevel }, ref) => {
  const map = React.useContext(MapContext);
  const geolocateControl = useRef<mapboxgl.GeolocateControl | null>(null);

  useImperativeHandle(ref, () => ({
    setCamera: (options: { centerCoordinate?: [number, number]; zoomLevel?: number; heading?: number; pitch?: number; animationDuration?: number }) => {
      if (!map) return;

      map.easeTo({
        center: options.centerCoordinate,
        zoom: options.zoomLevel,
        bearing: options.heading,
        pitch: options.pitch,
        duration: options.animationDuration || 1000,
      });
    },
    flyTo: (options: any) => {
      if (!map) return;
      map.flyTo(options);
    },
  }));

  useEffect(() => {
    if (!map) return;

    if (centerCoordinate) {
      map.easeTo({
        center: centerCoordinate,
        zoom: zoomLevel,
        bearing: heading,
        pitch: pitch,
        duration: animationDuration,
      });
    }
  }, [map, centerCoordinate, zoomLevel, heading, pitch, animationDuration]);

  useEffect(() => {
    if (!map || !followUserLocation) return;

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
    setTimeout(() => {
      geolocateControl.current?.trigger();
    }, 100);

    return () => {
      if (geolocateControl.current) {
        map.removeControl(geolocateControl.current);
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
  anchor?: { x: number; y: number };
  onSelected?: () => void;
}

// PointAnnotation component
export const PointAnnotation: React.FC<PointAnnotationProps> = ({ id, coordinate, title, children, anchor = { x: 0.5, y: 0.5 }, onSelected }) => {
  const map = React.useContext(MapContext);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map || !coordinate) return;

    // Create a container for React children
    const container = document.createElement('div');
    container.style.cursor = 'pointer';
    containerRef.current = container;

    // If there are children, render them into the container
    if (children) {
      // Simple case - just show a marker
      container.innerHTML = '<div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>';
    }

    markerRef.current = new mapboxgl.Marker({
      element: container,
      anchor: 'center',
    })
      .setLngLat(coordinate)
      .addTo(map);

    if (title) {
      markerRef.current.setPopup(new mapboxgl.Popup().setText(title));
    }

    if (onSelected) {
      container.addEventListener('click', onSelected);
    }

    return () => {
      markerRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coordinate, id]);

  // Update position when coordinate changes
  useEffect(() => {
    if (markerRef.current && coordinate) {
      markerRef.current.setLngLat(coordinate);
    }
  }, [coordinate]);

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
    map.on('load', () => {
      geolocate.trigger();
    });

    return () => {
      map.removeControl(geolocate);
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
