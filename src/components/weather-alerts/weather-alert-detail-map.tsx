import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import Mapbox from '@/components/maps/mapbox';
import { getSeverityColor } from '@/lib/weather-alert-utils';
import { parseCenterLocation, parsePolygonGeoJSON } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

interface WeatherAlertDetailMapProps {
  alert: WeatherAlertResultData;
}

export const WeatherAlertDetailMap: React.FC<WeatherAlertDetailMapProps> = ({ alert }) => {
  const cameraRef = useRef<any>(null);
  const severityColor = getSeverityColor(alert.Severity);

  const polygonGeoJSON = useMemo(() => parsePolygonGeoJSON(alert.Polygon), [alert.Polygon]);
  const centerLocation = useMemo(() => parseCenterLocation(alert.CenterGeoLocation), [alert.CenterGeoLocation]);

  // Compute bounds from polygon for camera
  const bounds = useMemo(() => {
    if (!polygonGeoJSON || !polygonGeoJSON.geometry) return null;

    const geometry = polygonGeoJSON.geometry as GeoJSON.Polygon;
    const coords = geometry.coordinates?.[0];
    if (!coords || coords.length === 0) return null;

    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
      paddingTop: 40,
      paddingBottom: 40,
      paddingLeft: 40,
      paddingRight: 40,
    };
  }, [polygonGeoJSON]);

  const cameraProps = useMemo(() => {
    if (bounds) {
      return { bounds };
    }
    if (centerLocation) {
      return {
        centerCoordinate: [centerLocation.longitude, centerLocation.latitude] as [number, number],
        zoomLevel: 8,
      };
    }
    return { zoomLevel: 4 };
  }, [bounds, centerLocation]);

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
        <Mapbox.Camera ref={cameraRef} {...cameraProps} animationDuration={0} />

        {polygonGeoJSON ? (
          <Mapbox.ShapeSource id="alert-polygon" shape={polygonGeoJSON}>
            <Mapbox.FillLayer
              id="alert-polygon-fill"
              style={{
                fillColor: severityColor,
                fillOpacity: 0.2,
              }}
            />
            <Mapbox.LineLayer
              id="alert-polygon-line"
              style={{
                lineColor: severityColor,
                lineWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        {!polygonGeoJSON && centerLocation ? (
          <Mapbox.PointAnnotation
            id="alert-center"
            coordinate={[centerLocation.longitude, centerLocation.latitude]}
          >
            <View style={[styles.marker, { backgroundColor: severityColor }]} />
          </Mapbox.PointAnnotation>
        ) : null}
      </Mapbox.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
