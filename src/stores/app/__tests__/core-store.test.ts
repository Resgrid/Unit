import { renderHook, act } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock all async dependencies that cause the overlapping act() calls
jest.mock('@/api/config/config', () => ({
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

const mockGetActiveUnitId = getActiveUnitId as jest.MockedFunction<typeof getActiveUnitId>;
const mockGetActiveCallId = getActiveCallId as jest.MockedFunction<typeof getActiveCallId>;

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
    });

    it('should skip initialization if already initialized', async () => {
      mockGetActiveUnitId.mockReturnValue(null);
      mockGetActiveCallId.mockReturnValue(null);

      const { result } = renderHook(() => useCoreStore());

      // First initialization
      await act(async () => {
        await result.current.init();
      });

      expect(result.current.isInitialized).toBe(true);

      // Second initialization should skip
      await act(async () => {
        await result.current.init();
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isInitializing).toBe(false);
    });

    it('should handle initialization with no active unit or call', async () => {
      mockGetActiveUnitId.mockReturnValue(null);
      mockGetActiveCallId.mockReturnValue(null);

      const { result } = renderHook(() => useCoreStore());

      await act(async () => {
        await result.current.init();
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.error).toBe(null);
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
