import { AlertTriangle, CloudLightning, Flame, Heart, Leaf, type LucideIcon } from 'lucide-react-native';

import { WeatherAlertCategory, WeatherAlertSeverity, WeatherAlertStatus } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

export const SEVERITY_COLORS: Record<number, string> = {
  [WeatherAlertSeverity.Extreme]: '#7B1FA2',
  [WeatherAlertSeverity.Severe]: '#D32F2F',
  [WeatherAlertSeverity.Moderate]: '#F57C00',
  [WeatherAlertSeverity.Minor]: '#FBC02D',
  [WeatherAlertSeverity.Unknown]: '#9E9E9E',
};

export const SEVERITY_DARK_BG: Record<number, string> = {
  [WeatherAlertSeverity.Extreme]: 'rgba(123,31,162,0.2)',
  [WeatherAlertSeverity.Severe]: 'rgba(211,47,47,0.2)',
  [WeatherAlertSeverity.Moderate]: 'rgba(245,124,0,0.2)',
  [WeatherAlertSeverity.Minor]: 'rgba(251,192,45,0.2)',
  [WeatherAlertSeverity.Unknown]: 'rgba(158,158,158,0.2)',
};

export const getSeverityColor = (severity: number): string => {
  return SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[WeatherAlertSeverity.Unknown];
};

export const getSeverityTranslationKey = (severity: number): string => {
  const keys: Record<number, string> = {
    [WeatherAlertSeverity.Extreme]: 'weather_alerts.severity.extreme',
    [WeatherAlertSeverity.Severe]: 'weather_alerts.severity.severe',
    [WeatherAlertSeverity.Moderate]: 'weather_alerts.severity.moderate',
    [WeatherAlertSeverity.Minor]: 'weather_alerts.severity.minor',
    [WeatherAlertSeverity.Unknown]: 'weather_alerts.severity.unknown',
  };
  return keys[severity] ?? keys[WeatherAlertSeverity.Unknown];
};

export const getCategoryIcon = (category: number): LucideIcon => {
  const icons: Record<number, LucideIcon> = {
    [WeatherAlertCategory.Met]: CloudLightning,
    [WeatherAlertCategory.Fire]: Flame,
    [WeatherAlertCategory.Health]: Heart,
    [WeatherAlertCategory.Env]: Leaf,
    [WeatherAlertCategory.Other]: AlertTriangle,
  };
  return icons[category] ?? icons[WeatherAlertCategory.Other];
};

export const parsePolygonGeoJSON = (polygonStr: string): GeoJSON.Feature | null => {
  if (!polygonStr) return null;

  try {
    // Try parsing as GeoJSON first
    const parsed = JSON.parse(polygonStr);
    if (parsed.type === 'Feature') return parsed;
    if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
      return { type: 'Feature', properties: {}, geometry: parsed };
    }
    return null;
  } catch {
    // Try parsing as coordinate pairs "lat,lng lat,lng ..."
    try {
      const coords = polygonStr
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [lat, lng] = pair.split(',').map(Number);
          return [lng, lat];
        });

      if (coords.length < 3) return null;

      // Close the polygon if needed
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([...first]);
      }

      return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      };
    } catch {
      return null;
    }
  }
};

export const parseCenterLocation = (centerStr: string): { latitude: number; longitude: number } | null => {
  if (!centerStr) return null;

  try {
    const [lat, lng] = centerStr.split(',').map(Number);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
};

export const sortAlertsBySeverity = (alerts: WeatherAlertResultData[]): WeatherAlertResultData[] => {
  return [...alerts].sort((a, b) => {
    if (a.Severity !== b.Severity) return a.Severity - b.Severity;
    return new Date(b.EffectiveUtc).getTime() - new Date(a.EffectiveUtc).getTime();
  });
};

export const isAlertActive = (alert: WeatherAlertResultData): boolean => {
  if (alert.Status !== WeatherAlertStatus.Active) return false;
  if (alert.ExpiresUtc) {
    return new Date(alert.ExpiresUtc).getTime() > Date.now();
  }
  return true;
};
