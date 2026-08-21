import { renderHook, act } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock all async dependencies that cause the overlapping act() calls
jest.mock('@/api/config', () => ({
  getConfig: jest.fn(),
}));

jest.mock('@/api/satuses/statuses', () => ({
  getAllUnitStatuses: jest.fn(),
}));

jest.mock('@/api/units/unitStatuses', () => ({
  getUnitStatus: jest.fn(),
}));

jest.mock('@/lib/storage/app', () => ({
  getActiveUnitId: jest.fn(),
  getActiveCallId: jest.fn(),
  setActiveUnitId: jest.fn(),
  setActiveCallId: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: {
    getState: jest.fn(() => ({
      fetchCalls: jest.fn(),
      fetchCallPriorities: jest.fn(),
      calls: [],
      callPriorities: [],
    })),
  },
}));

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: {
    getState: jest.fn(() => ({
      fetchUnits: jest.fn(),
      units: [],
      unitStatuses: [],
    })),
  },
}));

// Mock the storage layer used by zustand persist
jest.mock('@/lib/storage', () => ({
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Import after mocks
import { useCoreStore } from '../core-store';
import { getActiveUnitId, getActiveCallId } from '@/lib/storage/app';
import { getConfig } from '@/api/config';
import { logger } from '@/lib/logging';
import { GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { getUnitStatus } from '@/api/units/unitStatuses';
import { useUnitsStore } from '@/stores/units/store';

const mockGetActiveUnitId = getActiveUnitId as jest.MockedFunction<typeof getActiveUnitId>;
const mockGetActiveCallId = getActiveCallId as jest.MockedFunction<typeof getActiveCallId>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe('Core Store', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset store state by creating a fresh instance
    useCoreStore.setState({
      activeUnitId: null,
      activeUnit: null,
      activeUnitStatus: null,
      activeUnitStatusType: null,
      activeStatuses: null,
      activeCallId: null,
      activeCall: null,
      activePriority: null,
      config: null,
      isLoading: false,
      isInitialized: false,
      isInitializing: false,
      error: null,
    });
  });

  describe('Initialization', () => {
    it('should prevent multiple simultaneous initializations', async () => {
      mockGetActiveUnitId.mockReturnValue(null);
      mockGetActiveCallId.mockReturnValue(null);
      mockGetConfig.mockResolvedValue({
        Data: {
          EventingUrl: 'https://eventing.example.com/',
          GoogleMapsKey: 'test-key',
        } as GetConfigResultData,
      } as any);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        // Start first initialization
        const firstInit = result.current.init();

        // Try to start second initialization while first is in progress
        const secondInit = result.current.init();

        // Wait for both to complete
        await Promise.all([firstInit, secondInit]);
      });

      // Should be initialized only once
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.config).toEqual({
        EventingUrl: 'https://eventing.example.com/',
        GoogleMapsKey: 'test-key',
      });
    });

    it('should skip initialization if already initialized', async () => {
      mockGetActiveUnitId.mockReturnValue(null);
      mockGetActiveCallId.mockReturnValue(null);
      mockGetConfig.mockResolvedValue({
        Data: {
          EventingUrl: 'https://eventing.example.com/',
        } as GetConfigResultData,
      } as any);

      const { result } = renderHook(() => useCoreStore());

      // First initialization
      await act(async () => {
        await result.current.init();
      });

      expect(result.current.isInitialized).toBe(true);

      // Clear mock to verify second call doesn't happen
      jest.clearAllMocks();

      // Second initialization should skip
      await act(async () => {
        await result.current.init();
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isInitializing).toBe(false);
      expect(mockGetConfig).not.toHaveBeenCalled();
    });

    it('should handle initialization with no active unit or call', async () => {
      mockGetActiveUnitId.mockReturnValue(null);
      mockGetActiveCallId.mockReturnValue(null);
      mockGetConfig.mockResolvedValue({
        Data: {
          EventingUrl: 'https://eventing.example.com/',
        } as GetConfigResultData,
      } as any);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        await result.current.init();
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.config).toEqual({
        EventingUrl: 'https://eventing.example.com/',
      });
      expect(mockGetConfig).toHaveBeenCalledTimes(1);
    });

    it('should fetch config first during initialization', async () => {
      mockGetActiveUnitId.mockReturnValue(null);
      mockGetActiveCallId.mockReturnValue(null);

      const mockConfigData = {
        EventingUrl: 'https://eventing.example.com/',
        GoogleMapsKey: 'test-google-key',
        OpenWeatherApiKey: 'test-weather-key',
      } as GetConfigResultData;

      mockGetConfig.mockResolvedValue({
        Data: mockConfigData,
      } as any);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        await result.current.init();
      });

      expect(mockGetConfig).toHaveBeenCalledTimes(1);
      expect(result.current.config).toEqual(mockConfigData);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('should handle config fetch errors during initialization', async () => {
      mockGetActiveUnitId.mockReturnValue(null);
      mockGetActiveCallId.mockReturnValue(null);

      const configError = new Error('Failed to fetch config');
      mockGetConfig.mockRejectedValue(configError);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        await expect(result.current.init()).rejects.toThrow('Failed to fetch config');
      });

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.error).toBe('Failed to init core app data');
      expect(result.current.config).toBe(null);
    });
  });

  describe('Config Management', () => {
    it('should fetch config successfully', async () => {
      const mockConfigData = {
        EventingUrl: 'https://eventing.example.com/',
        GoogleMapsKey: 'test-google-key',
        MapUrl: 'https://maps.example.com/',
        LoggingKey: 'test-logging-key',
      } as GetConfigResultData;

      mockGetConfig.mockResolvedValue({
        Data: mockConfigData,
      } as any);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        await result.current.fetchConfig();
      });

      expect(mockGetConfig).toHaveBeenCalledTimes(1);
      expect(result.current.config).toEqual(mockConfigData);
      expect(result.current.error).toBe(null);
    });

    it('should handle config fetch errors', async () => {
      const configError = new Error('Config service unavailable');
      mockGetConfig.mockRejectedValue(configError);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        try {
          await result.current.fetchConfig();
        } catch (error) {
          // Expected to throw since fetchConfig re-throws the error
          expect(error).toBe(configError);
        }
      });

      expect(result.current.config).toBe(null);
      expect(result.current.error).toBe('Failed to fetch config');
      expect(result.current.isLoading).toBe(false);
    });

    it('should log transient network errors at warn level, not error', async () => {
      // Axios "Network Error" — no response received (offline / background launch)
      const networkError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        code: 'ERR_NETWORK',
      });
      mockGetConfig.mockRejectedValue(networkError);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        await expect(result.current.fetchConfig()).rejects.toBe(networkError);
      });

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('network connectivity') }));
      expect(logger.error).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Failed to fetch config');
    });

    it('should provide EventingUrl for SignalR connections', async () => {
      const eventingUrl = 'https://eventing.resgrid.com/';
      mockGetConfig.mockResolvedValue({
        Data: {
          EventingUrl: eventingUrl,
          GoogleMapsKey: 'test-key',
        } as GetConfigResultData,
      } as any);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        await result.current.fetchConfig();
      });

      expect(result.current.config?.EventingUrl).toBe(eventingUrl);
    });
  });

  describe('setActiveUnit', () => {
    const activeUnit = { UnitId: 'unit-1', Name: 'Engine 6', Type: '3' } as any;
    const unitStatuses = [
      { UnitType: '0', StatusId: 's0', Statuses: [{ Text: 'Available' }] },
      { UnitType: '3', StatusId: 's3', Statuses: [{ Text: 'Available' }] },
    ] as any[];

    beforeEach(() => {
      (useUnitsStore.getState as jest.Mock).mockReturnValue({
        fetchUnits: jest.fn(async () => undefined),
        units: [activeUnit],
        unitStatuses,
      });
      (getUnitStatus as jest.Mock).mockImplementation(async () => ({ Data: { State: 'Available' } }));
    });

    it('should reuse the statuses fetchUnits already loaded instead of refetching them', async () => {
      await useCoreStore.getState().setActiveUnit('unit-1');

      // fetchUnits() already issues /Statuses/GetAllUnitStatuses — calling it a
      // second time here was a duplicate request on every unit selection.
      expect(getAllUnitStatuses).not.toHaveBeenCalled();
    });

    it('should resolve activeStatuses for the unit type from the already-fetched data', async () => {
      await useCoreStore.getState().setActiveUnit('unit-1');

      expect(useCoreStore.getState().activeStatuses).toEqual(unitStatuses[1]);
      expect(useCoreStore.getState().activeUnit).toEqual(activeUnit);
    });

    it('should fall back to the default unit type statuses when the type has none', async () => {
      (useUnitsStore.getState as jest.Mock).mockReturnValue({
        fetchUnits: jest.fn(async () => undefined),
        units: [{ ...activeUnit, Type: '99' }],
        unitStatuses,
      });

      await useCoreStore.getState().setActiveUnit('unit-1');

      expect(useCoreStore.getState().activeStatuses).toEqual(unitStatuses[0]);
    });

    it('should log a network failure at warn rather than error', async () => {
      // Axios "Network Error" — no response received (offline / background launch)
      const networkError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        code: 'ERR_NETWORK',
      });
      (useUnitsStore.getState as jest.Mock).mockReturnValue({
        fetchUnits: jest.fn(async () => {
          throw networkError;
        }),
        units: [],
        unitStatuses: [],
      });

      await useCoreStore.getState().setActiveUnit('unit-1');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to set active unit due to network connectivity',
        })
      );
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Store State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useCoreStore());

      expect(result.current.activeUnitId).toBe(null);
      expect(result.current.activeUnit).toBe(null);
      expect(result.current.activeCallId).toBe(null);
      expect(result.current.activeCall).toBe(null);
      expect(result.current.config).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should have all required methods', () => {
      const { result } = renderHook(() => useCoreStore());

      expect(typeof result.current.init).toBe('function');
      expect(typeof result.current.setActiveUnit).toBe('function');
      expect(typeof result.current.setActiveUnitWithFetch).toBe('function');
      expect(typeof result.current.setActiveCall).toBe('function');
      expect(typeof result.current.fetchConfig).toBe('function');
    });
  });
});
