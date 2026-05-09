import { getActiveAlerts, getWeatherAlert, getWeatherAlertSettings } from '@/api/weather-alerts/weather-alerts';
import { useWeatherAlertsStore } from '../store';

jest.mock('@/api/weather-alerts/weather-alerts');

const mockGetActiveAlerts = getActiveAlerts as jest.MockedFunction<typeof getActiveAlerts>;
const mockGetWeatherAlert = getWeatherAlert as jest.MockedFunction<typeof getWeatherAlert>;
const mockGetWeatherAlertSettings = getWeatherAlertSettings as jest.MockedFunction<typeof getWeatherAlertSettings>;

const createMockAlert = (overrides = {}) => ({
  WeatherAlertId: 'alert-1',
  DepartmentId: 1,
  Event: 'Tornado Warning',
  Headline: 'Tornado Warning for County',
  Description: 'A tornado has been spotted.',
  Instructions: 'Take shelter immediately.',
  Severity: 0,
  Category: 0,
  Urgency: 0,
  Certainty: 0,
  Status: 0,
  SourceType: 0,
  SourceAlertId: 'nws-1',
  SenderName: 'NWS',
  AreaDescription: 'County A',
  Polygon: '',
  CenterGeoLocation: '35.0,-97.0',
  EffectiveUtc: '2026-04-15T10:00:00Z',
  OnsetUtc: '2026-04-15T10:00:00Z',
  ExpiresUtc: '2026-04-15T14:00:00Z',
  Ends: '',
  ReceivedOnUtc: '2026-04-15T10:00:00Z',
  UpdatedOnUtc: '',
  WebUrl: '',
  ZoneCode: 'OKC001',
  MessageType: 'Alert',
  ...overrides,
});

const createMockSettings = (overrides = {}) => ({
  WeatherAlertsEnabled: true,
  MinimumSeverity: 4,
  AutoMessageSeverity: 0,
  CallIntegrationEnabled: false,
  AutoMessageSchedule: [],
  ExcludedEvents: '',
  ...overrides,
});

describe('useWeatherAlertsStore', () => {
  beforeEach(() => {
    useWeatherAlertsStore.getState().reset();
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should fetch settings and alerts when enabled', async () => {
      mockGetWeatherAlertSettings.mockResolvedValue({
        Data: createMockSettings(),
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });
      mockGetActiveAlerts.mockResolvedValue({
        Data: [createMockAlert()],
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });

      await useWeatherAlertsStore.getState().init();

      expect(mockGetWeatherAlertSettings).toHaveBeenCalledTimes(1);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(1);
      expect(useWeatherAlertsStore.getState().alerts).toHaveLength(1);
      expect(useWeatherAlertsStore.getState().isInitialized).toBe(true);
      expect(useWeatherAlertsStore.getState().settings?.WeatherAlertsEnabled).toBe(true);
    });

    it('should not fetch alerts when disabled', async () => {
      mockGetWeatherAlertSettings.mockResolvedValue({
        Data: createMockSettings({ WeatherAlertsEnabled: false }),
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });

      await useWeatherAlertsStore.getState().init();

      expect(mockGetActiveAlerts).not.toHaveBeenCalled();
      expect(useWeatherAlertsStore.getState().alerts).toHaveLength(0);
      expect(useWeatherAlertsStore.getState().isInitialized).toBe(true);
    });

    it('should not re-initialize if already initialized', async () => {
      mockGetWeatherAlertSettings.mockResolvedValue({
        Data: createMockSettings(),
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });
      mockGetActiveAlerts.mockResolvedValue({
        Data: [],
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });

      await useWeatherAlertsStore.getState().init();
      await useWeatherAlertsStore.getState().init();

      expect(mockGetWeatherAlertSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchActiveAlerts', () => {
    it('should update alerts sorted by severity', async () => {
      const alerts = [
        createMockAlert({ WeatherAlertId: 'a1', Severity: 2 }),
        createMockAlert({ WeatherAlertId: 'a2', Severity: 0 }),
      ];
      mockGetActiveAlerts.mockResolvedValue({
        Data: alerts,
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });

      await useWeatherAlertsStore.getState().fetchActiveAlerts();

      const state = useWeatherAlertsStore.getState();
      expect(state.alerts[0].WeatherAlertId).toBe('a2');
      expect(state.alerts[1].WeatherAlertId).toBe('a1');
      expect(state.isLoading).toBe(false);
    });

    it('should handle errors', async () => {
      mockGetActiveAlerts.mockRejectedValue(new Error('Network error'));

      await useWeatherAlertsStore.getState().fetchActiveAlerts();

      expect(useWeatherAlertsStore.getState().error).toBe('Failed to fetch weather alerts');
    });
  });

  describe('handleAlertReceived', () => {
    it('should prepend new alert to list', async () => {
      useWeatherAlertsStore.setState({ alerts: [createMockAlert({ WeatherAlertId: 'existing' })] });
      const newAlert = createMockAlert({ WeatherAlertId: 'new-alert', Severity: 1 });
      mockGetWeatherAlert.mockResolvedValue({
        Data: newAlert,
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });

      await useWeatherAlertsStore.getState().handleAlertReceived('new-alert');

      expect(useWeatherAlertsStore.getState().alerts).toHaveLength(2);
    });
  });

  describe('handleAlertExpired', () => {
    it('should remove alert from list', () => {
      useWeatherAlertsStore.setState({
        alerts: [
          createMockAlert({ WeatherAlertId: 'a1' }),
          createMockAlert({ WeatherAlertId: 'a2' }),
        ],
      });

      useWeatherAlertsStore.getState().handleAlertExpired('a1');

      const alerts = useWeatherAlertsStore.getState().alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0].WeatherAlertId).toBe('a2');
    });
  });

  describe('filters and sorting', () => {
    it('should set severity filter', () => {
      useWeatherAlertsStore.getState().setSeverityFilter(1);
      expect(useWeatherAlertsStore.getState().severityFilter).toBe(1);

      useWeatherAlertsStore.getState().setSeverityFilter(null);
      expect(useWeatherAlertsStore.getState().severityFilter).toBeNull();
    });

    it('should set sort mode', () => {
      useWeatherAlertsStore.getState().setSortBy('newest');
      expect(useWeatherAlertsStore.getState().sortBy).toBe('newest');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      useWeatherAlertsStore.setState({
        alerts: [createMockAlert()],
        isInitialized: true,
        settings: createMockSettings(),
      });

      useWeatherAlertsStore.getState().reset();

      const state = useWeatherAlertsStore.getState();
      expect(state.alerts).toHaveLength(0);
      expect(state.isInitialized).toBe(false);
      expect(state.settings).toBeNull();
    });
  });
});
