import { getActiveCallId, getActiveUnitId } from '@/lib/storage/app';
import { useCallsStore } from '@/stores/calls/store';
import { useUnitsStore } from '@/stores/units/store';

import { useCoreStore } from '../core-store';

// Mock dependencies
jest.mock('@/lib/storage/app');
jest.mock('@/stores/calls/store');
jest.mock('@/stores/units/store');
jest.mock('@/api/config/config');
jest.mock('@/api/satuses/statuses');
jest.mock('@/api/units/unitStatuses');
jest.mock('@/lib/logging');

const mockGetActiveUnitId = getActiveUnitId as jest.MockedFunction<typeof getActiveUnitId>;
const mockGetActiveCallId = getActiveCallId as jest.MockedFunction<typeof getActiveCallId>;

describe('Core Store Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store state
    useCoreStore.setState({
      isInitialized: false,
      isInitializing: false,
      isLoading: false,
      error: null,
    });
  });

  it('should prevent multiple simultaneous initializations', async () => {
    mockGetActiveUnitId.mockReturnValue('unit-1');
    mockGetActiveCallId.mockReturnValue('call-1');

    const store = useCoreStore.getState();

    // Start two initializations simultaneously
    const init1 = store.init();
    const init2 = store.init();

    await Promise.all([init1, init2]);

    // Should only initialize once
    expect(useCoreStore.getState().isInitialized).toBe(true);
  });

  it('should skip initialization if already initialized', async () => {
    // Set as already initialized
    useCoreStore.setState({
      isInitialized: true,
      isInitializing: false,
      isLoading: false,
    });

    const store = useCoreStore.getState();
    await store.init();

    // Should remain initialized without re-running
    expect(useCoreStore.getState().isInitialized).toBe(true);
  });

  it('should handle initialization errors gracefully', async () => {
    mockGetActiveUnitId.mockImplementation(() => {
      throw new Error('Storage error');
    });

    const store = useCoreStore.getState();
    await store.init();

    const state = useCoreStore.getState();
    expect(state.isInitialized).toBe(false);
    expect(state.isInitializing).toBe(false);
    expect(state.error).toBe('Failed to init core app data');
  });

  it('should allow retry after failed initialization', async () => {
    // First initialization fails
    mockGetActiveUnitId.mockImplementationOnce(() => {
      throw new Error('Storage error');
    });

    const store = useCoreStore.getState();
    await store.init();

    expect(useCoreStore.getState().isInitialized).toBe(false);
    expect(useCoreStore.getState().error).toBe('Failed to init core app data');

    // Second initialization succeeds
    mockGetActiveUnitId.mockReturnValue('unit-1');
    mockGetActiveCallId.mockReturnValue('call-1');

    await store.init();

    expect(useCoreStore.getState().isInitialized).toBe(true);
    expect(useCoreStore.getState().error).toBe(null);
  });

  it('should handle concurrent initialization attempts correctly', async () => {
    let initCount = 0;
    const originalInit = useCoreStore.getState().init;

    // Mock the initialization to count how many times it runs
    const mockInit = jest.fn(async () => {
      initCount++;
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async work
      useCoreStore.setState({
        isInitialized: true,
        isInitializing: false,
        isLoading: false,
      });
    });

    useCoreStore.setState({ init: mockInit });

    // Start multiple initializations
    const promises = Array.from({ length: 5 }, () => useCoreStore.getState().init());
    await Promise.all(promises);

    // Should only run once despite multiple calls
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(useCoreStore.getState().isInitialized).toBe(true);
  });
});
