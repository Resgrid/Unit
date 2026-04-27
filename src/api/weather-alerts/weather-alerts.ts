import { type ActiveWeatherAlertsResult } from '@/models/v4/weatherAlerts/activeWeatherAlertsResult';
import { type WeatherAlertResult } from '@/models/v4/weatherAlerts/weatherAlertResult';
import { type WeatherAlertSettingsResult } from '@/models/v4/weatherAlerts/weatherAlertSettingsResult';
import { type WeatherAlertZonesResult } from '@/models/v4/weatherAlerts/weatherAlertZonesResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getActiveAlertsApi = createCachedApiEndpoint('/WeatherAlerts/GetActiveAlerts', { ttl: 60 * 1000, enabled: true });
const getWeatherAlertApi = createApiEndpoint('/WeatherAlerts/GetWeatherAlert');
const getAlertsNearLocationApi = createApiEndpoint('/WeatherAlerts/GetAlertsNearLocation');
const getAlertHistoryApi = createApiEndpoint('/WeatherAlerts/GetAlertHistory');
const getSettingsApi = createCachedApiEndpoint('/WeatherAlerts/GetSettings', { ttl: 5 * 60 * 1000, enabled: true });
const getZonesApi = createCachedApiEndpoint('/WeatherAlerts/GetZones', { ttl: 5 * 60 * 1000, enabled: true });

export const getActiveAlerts = async () => {
  const response = await getActiveAlertsApi.get<ActiveWeatherAlertsResult>();
  return response.data;
};

export const getWeatherAlert = async (alertId: string) => {
  const response = await getWeatherAlertApi.get<WeatherAlertResult>({
    alertId: encodeURIComponent(alertId),
  });
  return response.data;
};

export const getAlertsNearLocation = async (lat: number, lng: number, radiusMiles: number) => {
  const response = await getAlertsNearLocationApi.get<ActiveWeatherAlertsResult>({
    lat,
    lng,
    radiusMiles,
  });
  return response.data;
};

export const getAlertHistory = async (startDate: string, endDate: string) => {
  const response = await getAlertHistoryApi.get<ActiveWeatherAlertsResult>({
    startDate,
    endDate,
  });
  return response.data;
};

export const getWeatherAlertSettings = async () => {
  const response = await getSettingsApi.get<WeatherAlertSettingsResult>();
  return response.data;
};

export const getWeatherAlertZones = async () => {
  const response = await getZonesApi.get<WeatherAlertZonesResult>();
  return response.data;
};
