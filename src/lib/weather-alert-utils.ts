import { AlertTriangle, CloudLightning, Flame, Heart, Leaf, type LucideIcon } from 'lucide-react-native';

import { WeatherAlertCategory, WeatherAlertSeverity, WeatherAlertStatus } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

type WeatherAlertPolygon = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type WeatherAlertPolygonFeature = GeoJSON.Feature<WeatherAlertPolygon>;

export interface WeatherAlertMapBounds {
  ne: [number, number];
  sw: [number, number];
}

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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isPolygonGeometry = (value: unknown): value is WeatherAlertPolygon => {
  if (!isRecord(value)) return false;
  return (value.type === 'Polygon' || value.type === 'MultiPolygon') && Array.isArray(value.coordinates);
};

export const parsePolygonGeoJSON = (polygonStr: string): WeatherAlertPolygonFeature | null => {
  if (!polygonStr) return null;

  try {
    // Try parsing as GeoJSON first
    const parsed: unknown = JSON.parse(polygonStr);
    if (!isRecord(parsed)) return null;

    if (parsed.type === 'Feature' && isPolygonGeometry(parsed.geometry)) {
      return {
        type: 'Feature',
        properties: isRecord(parsed.properties) ? parsed.properties : {},
        geometry: parsed.geometry,
      };
    }
    if (isPolygonGeometry(parsed)) {
      return { type: 'Feature', properties: {}, geometry: parsed };
    }
    return null;
  } catch {
    // Try parsing as coordinate pairs "lat,lng lat,lng ..."
    try {
      const coords = polygonStr
        .trim()
        .split(/\s+/)
        .reduce<[number, number][]>((acc, pair) => {
          const parts = pair.split(',');
          if (parts.length < 2) return acc;
          const lat = Number(parts[0]);
          const lng = Number(parts[1]);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            acc.push([lng, lat]);
          }
          return acc;
        }, []);

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

export const getPolygonBounds = (feature: WeatherAlertPolygonFeature): WeatherAlertMapBounds | null => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const position of ring) {
        const [lng, lat] = position;
        if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          continue;
        }

        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }

  if (![minLng, maxLng, minLat, maxLat].every(Number.isFinite)) return null;

  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
};

export const parseCenterLocation = (centerStr: string): { latitude: number; longitude: number } | null => {
  if (!centerStr) return null;

  const parts = centerStr.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2) return null;

  const [latitude, longitude] = parts;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
};

export const parseWeatherAlertDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const value = dateStr.trim();
  const departmentDateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);

  if (departmentDateMatch) {
    const [, monthText, dayText, yearText, hourText, minuteText, secondText = '0', periodText] = departmentDateMatch;
    const month = Number(monthText);
    const day = Number(dayText);
    const year = Number(yearText);
    let hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const period = periodText?.toUpperCase();

    if (period) {
      if (hour < 1 || hour > 12) return null;
      hour = hour % 12;
      if (period === 'PM') hour += 12;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;

    const date = new Date(year, month - 1, day, hour, minute, second);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
      return null;
    }

    return date;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const sortAlertsBySeverity = (alerts: WeatherAlertResultData[]): WeatherAlertResultData[] => {
  return [...alerts].sort((a, b) => {
    if (a.Severity !== b.Severity) return a.Severity - b.Severity;
    const bEffectiveTime = parseWeatherAlertDate(b.EffectiveOnUtc || b.EffectiveUtc)?.getTime() ?? 0;
    const aEffectiveTime = parseWeatherAlertDate(a.EffectiveOnUtc || a.EffectiveUtc)?.getTime() ?? 0;
    return bEffectiveTime - aEffectiveTime;
  });
};

export const isAlertActive = (alert: WeatherAlertResultData): boolean => {
  if (alert.Status !== WeatherAlertStatus.Active) return false;
  if (alert.ExpiresOnUtc || alert.ExpiresUtc) {
    const expiration = parseWeatherAlertDate(alert.ExpiresOnUtc || alert.ExpiresUtc);
    return expiration ? expiration.getTime() > Date.now() : true;
  }
  return true;
};
