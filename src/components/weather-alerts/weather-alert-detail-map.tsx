import type { Camera as MapboxCamera } from '@rnmapbox/maps';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import Mapbox from '@/components/maps/mapbox';
import { Text } from '@/components/ui/text';
import { getPolygonBounds, getSeverityColor, parseCenterLocation, parsePolygonGeoJSON } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

interface WeatherAlertDetailMapProps {
  alert: WeatherAlertResultData;
}

const MAP_PADDING = 40;

export const WeatherAlertDetailMap: React.FC<WeatherAlertDetailMapProps> = ({ alert }) => {
  const { t } = useTranslation();
  const cameraRef = useRef<MapboxCamera>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const severityColor = getSeverityColor(alert.Severity);

  const polygonGeoJSON = useMemo(() => parsePolygonGeoJSON(alert.Polygon), [alert.Polygon]);
  const centerLocation = useMemo(() => parseCenterLocation(alert.CenterGeoLocation), [alert.CenterGeoLocation]);
  const bounds = useMemo(() => (polygonGeoJSON ? getPolygonBounds(polygonGeoJSON) : null), [polygonGeoJSON]);
  const handleMapReady = useCallback(() => setIsMapReady(true), []);
  const mapCenter = useMemo(() => {
    if (centerLocation) return centerLocation;
    if (!bounds) return null;

    return {
      latitude: (bounds.ne[1] + bounds.sw[1]) / 2,
      longitude: (bounds.ne[0] + bounds.sw[0]) / 2,
    };
  }, [bounds, centerLocation]);

  useEffect(() => {
    if (!isMapReady || !cameraRef.current || !mapCenter) return;

    if (bounds && (bounds.ne[0] !== bounds.sw[0] || bounds.ne[1] !== bounds.sw[1])) {
      cameraRef.current.fitBounds(bounds.ne, bounds.sw, MAP_PADDING, 0);
      return;
    }

    cameraRef.current.setCamera({
      centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
      zoomLevel: 8,
      animationDuration: 0,
      animationMode: 'moveTo',
    });
  }, [bounds, isMapReady, mapCenter]);

  if (!mapCenter) {
    return (
      <View style={styles.container} className="items-center justify-center bg-background-100 dark:bg-background-800">
        <Text className="text-sm text-gray-500 dark:text-gray-400">{t('call_detail.no_location')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} onDidFinishLoadingMap={handleMapReady}>
        <Mapbox.Camera ref={cameraRef} centerCoordinate={[mapCenter.longitude, mapCenter.latitude]} zoomLevel={8} animationDuration={0} animationMode="moveTo" />

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
          <Mapbox.PointAnnotation id="alert-center" coordinate={[centerLocation.longitude, centerLocation.latitude]}>
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
