import { create } from 'zustand';

import { getActiveAlerts, getWeatherAlert, getWeatherAlertSettings } from '@/api/weather-alerts/weather-alerts';
import { sortAlertsBySeverity } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';
import { type WeatherAlertSettingsData } from '@/models/v4/weatherAlerts/weatherAlertSettingsData';

interface WeatherAlertsState {
  alerts: WeatherAlertResultData[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  lastFetchedAt: number;
  selectedAlert: WeatherAlertResultData | null;
  isLoadingDetail: boolean;
  settings: WeatherAlertSettingsData | null;
  severityFilter: number | null;
  sortBy: 'severity' | 'newest' | 'expiring';
  init: () => Promise<void>;
  fetchActiveAlerts: () => Promise<void>;
  fetchAlertDetail: (alertId: string) => Promise<void>;
  fetchSettings: () => Promise<void>;
  setSeverityFilter: (severity: number | null) => void;
  setSortBy: (sortBy: 'severity' | 'newest' | 'expiring') => void;
  handleAlertReceived: (alertId: string) => Promise<void>;
  handleAlertUpdated: (alertId: string) => Promise<void>;
  handleAlertExpired: (alertId: string) => void;
  reset: () => void;
}

export const useWeatherAlertsStore = create<WeatherAlertsState>((set, get) => ({
  alerts: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  lastFetchedAt: 0,
  selectedAlert: null,
  isLoadingDetail: false,
  settings: null,
  severityFilter: null,
  sortBy: 'severity',
  init: async () => {
    if (get().isInitialized || get().isLoading) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const settingsResponse = await getWeatherAlertSettings();
      const settings = settingsResponse.Data;
      set({ settings });

      if (settings.WeatherAlertsEnabled) {
        const alertsResponse = await getActiveAlerts();
        const alerts = Array.isArray(alertsResponse.Data) ? sortAlertsBySeverity(alertsResponse.Data) : [];
        set({ alerts });
      }

      set({ isLoading: false, isInitialized: true, lastFetchedAt: Date.now() });
    } catch (error) {
      set({ error: 'Failed to initialize weather alerts', isLoading: false, isInitialized: true });
    }
  },
  fetchActiveAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getActiveAlerts();
      const alerts = Array.isArray(response.Data) ? sortAlertsBySeverity(response.Data) : [];
      set({ alerts, isLoading: false, lastFetchedAt: Date.now() });
    } catch (error) {
      set({ error: 'Failed to fetch weather alerts', isLoading: false });
    }
  },
  fetchAlertDetail: async (alertId: string) => {
    set({ isLoadingDetail: true });
    try {
      const response = await getWeatherAlert(alertId);
      set({ selectedAlert: response.Data, isLoadingDetail: false });
    } catch (error) {
      set({ isLoadingDetail: false });
    }
  },
  fetchSettings: async () => {
    try {
      const response = await getWeatherAlertSettings();
      set({ settings: response.Data });
    } catch (error) {
      // Settings fetch failure is non-critical
    }
  },
  setSeverityFilter: (severity: number | null) => {
    set({ severityFilter: severity });
  },
  setSortBy: (sortBy: 'severity' | 'newest' | 'expiring') => {
    set({ sortBy });
  },
  handleAlertReceived: async (alertId: string) => {
    try {
      const response = await getWeatherAlert(alertId);
      const newAlert = response.Data;
      set((state) => {
        const exists = state.alerts.some((a) => a.WeatherAlertId === newAlert.WeatherAlertId);
        const updated = exists ? state.alerts.map((a) => (a.WeatherAlertId === newAlert.WeatherAlertId ? newAlert : a)) : [newAlert, ...state.alerts];
        return { alerts: sortAlertsBySeverity(updated) };
      });
    } catch (error) {
      // Silently fail for SignalR handler
    }
  },
  handleAlertUpdated: async (alertId: string) => {
    try {
      const response = await getWeatherAlert(alertId);
      const updatedAlert = response.Data;
      set((state) => ({
        alerts: sortAlertsBySeverity(state.alerts.map((a) => (a.WeatherAlertId === alertId ? updatedAlert : a))),
      }));
    } catch (error) {
      // Silently fail for SignalR handler
    }
  },
  handleAlertExpired: (alertId: string) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.WeatherAlertId !== alertId),
    }));
  },
  reset: () => {
    set({
      alerts: [],
      isLoading: false,
      isInitialized: false,
      error: null,
      lastFetchedAt: 0,
      selectedAlert: null,
      isLoadingDetail: false,
      settings: null,
      severityFilter: null,
      sortBy: 'severity',
    });
  },
}));
