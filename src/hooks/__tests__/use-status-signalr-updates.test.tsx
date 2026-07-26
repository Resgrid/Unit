import { act, renderHook } from '@testing-library/react-native';

import { logger } from '@/lib/logging';
import { useCoreStore } from '@/stores/app/core-store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { useStatusSignalRUpdates } from '../use-status-signalr-updates';

// Mock the dependencies
jest.mock('@/lib/logging');
jest.mock('@/stores/app/core-store');
jest.mock('@/stores/signalr/signalr-store');

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockUseSignalRStore = useSignalRStore as jest.MockedFunction<typeof useSignalRStore>;

describe('useStatusSignalRUpdates', () => {
  const mockRefreshActiveUnitStatus = jest.fn();
  const mockCoreState = {
    activeUnitId: '123' as string | null,
    refreshActiveUnitStatus: mockRefreshActiveUnitStatus,
  } as any;
  const mockSignalRState = {
    lastUnitStatusTimestamp: 0,
    lastUnitStatusMessage: null as unknown,
  } as any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Reset state to default values
    mockCoreState.activeUnitId = '123';
    mockCoreState.refreshActiveUnitStatus = mockRefreshActiveUnitStatus;
    mockRefreshActiveUnitStatus.mockResolvedValue(undefined);
    mockSignalRState.lastUnitStatusTimestamp = 0;
    mockSignalRState.lastUnitStatusMessage = null;

    // Mock core store with selector support
    mockUseCoreStore.mockImplementation((selector) => {
      if (selector) {
        return selector(mockCoreState);
      }
      return mockCoreState;
    });

    // Mock SignalR store with selector support
    mockUseSignalRStore.mockImplementation((selector) => {
      if (selector) {
        return selector(mockSignalRState);
      }
      return mockSignalRState;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const advancePastDebounce = () => {
    act(() => {
      jest.advanceTimersByTime(2000);
    });
  };

  it('should not process updates when no active unit', () => {
    mockCoreState.activeUnitId = null;
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should not process updates when timestamp is 0', () => {
    mockSignalRState.lastUnitStatusTimestamp = 0;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should not process updates when message is null', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = null;

    renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should process unit status update for active unit after the debounce delay', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    renderHook(useStatusSignalRUpdates);

    // Debounced — not called before the delay elapses
    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();

    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledWith('123');
  });

  it('should not process updates for different unit', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '456', State: 'Available' };

    renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should handle non-object message gracefully', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = 'invalid json';

    renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should not process the same timestamp twice', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    const { rerender } = renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledWith('123');

    mockRefreshActiveUnitStatus.mockClear();

    // Rerender with same timestamp
    rerender({});
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should process new timestamp after initial one', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    const { rerender } = renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledWith('123');

    mockRefreshActiveUnitStatus.mockClear();

    // Update with new timestamp
    mockSignalRState.lastUnitStatusTimestamp = 12346;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Busy' };

    rerender({});
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledWith('123');
  });

  it('should handle API errors gracefully', async () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    mockRefreshActiveUnitStatus.mockRejectedValue(new Error('API Error'));

    renderHook(useStatusSignalRUpdates);

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Should not crash the hook
    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith({
      message: 'Failed to process unit status update',
      context: { error: expect.any(Error) },
    });
  });

  it('should handle activeUnitId changes', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    const { rerender } = renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledWith('123');

    mockRefreshActiveUnitStatus.mockClear();

    // Change active unit
    mockCoreState.activeUnitId = '456';

    // New timestamp with a message for the new unit
    mockSignalRState.lastUnitStatusTimestamp = 12346;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '456', State: 'Available' };

    rerender({});
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledWith('456');
  });

  it('should handle message with no UnitId', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { State: 'Available' };

    renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should handle empty message object', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = {};

    renderHook(useStatusSignalRUpdates);
    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).not.toHaveBeenCalled();
  });

  it('should coalesce a burst of updates into a single refresh', () => {
    mockSignalRState.lastUnitStatusTimestamp = 12345;
    mockSignalRState.lastUnitStatusMessage = { UnitId: '123', State: 'Available' };

    const { rerender } = renderHook(useStatusSignalRUpdates);

    // Burst of updates before the debounce elapses
    mockSignalRState.lastUnitStatusTimestamp = 12346;
    rerender({});
    mockSignalRState.lastUnitStatusTimestamp = 12347;
    rerender({});

    advancePastDebounce();

    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledTimes(1);
    expect(mockRefreshActiveUnitStatus).toHaveBeenCalledWith('123');
  });
});
