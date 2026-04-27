jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((specifics: any) => specifics.ios || specifics.default),
    Version: 17,
  },
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  })),
}));

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getCheckInHistory, getTimerStatuses, getTimersForCall, performCheckIn } from '@/api/check-in-timers/check-in-timers';
import { useCheckInTimerStore } from '../store';

jest.mock('@/api/check-in-timers/check-in-timers');
jest.mock('@/services/offline-event-manager.service', () => ({
  offlineEventManager: {
    queueCheckInEvent: jest.fn(),
  },
}));
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetTimerStatuses = getTimerStatuses as jest.MockedFunction<typeof getTimerStatuses>;
const mockGetTimersForCall = getTimersForCall as jest.MockedFunction<typeof getTimersForCall>;
const mockGetCheckInHistory = getCheckInHistory as jest.MockedFunction<typeof getCheckInHistory>;
const mockPerformCheckIn = performCheckIn as jest.MockedFunction<typeof performCheckIn>;

describe('useCheckInTimerStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useCheckInTimerStore.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should have correct initial state', () => {
    const state = useCheckInTimerStore.getState();
    expect(state.timerStatuses).toEqual([]);
    expect(state.resolvedTimers).toEqual([]);
    expect(state.checkInHistory).toEqual([]);
    expect(state.isLoadingStatuses).toBe(false);
    expect(state.isLoadingHistory).toBe(false);
    expect(state.isCheckingIn).toBe(false);
    expect(state.statusError).toBeNull();
    expect(state.checkInError).toBeNull();
  });

  describe('fetchTimerStatuses', () => {
    it('should fetch and sort timer statuses by severity', async () => {
      const mockData = [
        { TargetEntityId: '1', Status: 'Ok', ElapsedMinutes: 5, DurationMinutes: 30, TargetType: 0, TargetTypeName: 'Unit', TargetName: 'Engine 1', UnitId: '1', LastCheckIn: '', WarningThresholdMinutes: 20 },
        { TargetEntityId: '2', Status: 'Overdue', ElapsedMinutes: 35, DurationMinutes: 30, TargetType: 0, TargetTypeName: 'Unit', TargetName: 'Ladder 1', UnitId: '2', LastCheckIn: '', WarningThresholdMinutes: 20 },
        { TargetEntityId: '3', Status: 'Warning', ElapsedMinutes: 22, DurationMinutes: 30, TargetType: 0, TargetTypeName: 'Unit', TargetName: 'Rescue 1', UnitId: '3', LastCheckIn: '', WarningThresholdMinutes: 20 },
      ];

      mockGetTimerStatuses.mockResolvedValue({ Data: mockData, PageSize: 0, Timestamp: '', Version: '', Node: '', RequestId: '', Status: '', Environment: '' });

      const { result } = renderHook(() => useCheckInTimerStore());

      await act(async () => {
        await result.current.fetchTimerStatuses(1);
      });

      await waitFor(() => {
        expect(result.current.timerStatuses).toHaveLength(3);
        expect(result.current.timerStatuses[0].Status).toBe('Overdue');
        expect(result.current.timerStatuses[1].Status).toBe('Warning');
        expect(result.current.timerStatuses[2].Status).toBe('Ok');
        expect(result.current.isLoadingStatuses).toBe(false);
      });
    });

    it('should handle fetch errors', async () => {
      mockGetTimerStatuses.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCheckInTimerStore());

      await act(async () => {
        await result.current.fetchTimerStatuses(1);
      });

      await waitFor(() => {
        expect(result.current.statusError).toBe('Network error');
        expect(result.current.isLoadingStatuses).toBe(false);
      });
    });
  });

  describe('performCheckIn', () => {
    it('should perform check-in and re-fetch statuses', async () => {
      mockPerformCheckIn.mockResolvedValue({ Data: {}, PageSize: 0, Timestamp: '', Version: '', Node: '', RequestId: '', Status: '', Environment: '' });
      mockGetTimerStatuses.mockResolvedValue({ Data: [], PageSize: 0, Timestamp: '', Version: '', Node: '', RequestId: '', Status: '', Environment: '' });

      const { result } = renderHook(() => useCheckInTimerStore());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.performCheckIn({ CallId: 1, CheckInType: 0 });
      });

      expect(success).toBe(true);
      expect(mockPerformCheckIn).toHaveBeenCalledWith({ CallId: 1, CheckInType: 0 });
      expect(result.current.isCheckingIn).toBe(false);
    });

    it('should handle check-in errors', async () => {
      mockPerformCheckIn.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useCheckInTimerStore());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.performCheckIn({ CallId: 1, CheckInType: 0 });
      });

      expect(success).toBe(false);
      expect(result.current.checkInError).toBe('Server error');
    });
  });

  describe('startPolling / stopPolling', () => {
    it('should start and stop polling', async () => {
      mockGetTimerStatuses.mockResolvedValue({ Data: [], PageSize: 0, Timestamp: '', Version: '', Node: '', RequestId: '', Status: '', Environment: '' });

      const { result } = renderHook(() => useCheckInTimerStore());

      act(() => {
        result.current.startPolling(1, 5000);
      });

      // Should have fetched immediately
      expect(mockGetTimerStatuses).toHaveBeenCalledTimes(1);

      // Advance timer
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockGetTimerStatuses).toHaveBeenCalledTimes(2);

      // Stop polling
      act(() => {
        result.current.stopPolling();
      });

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      // Should not have increased
      expect(mockGetTimerStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('reset', () => {
    it('should reset state to initial values', () => {
      useCheckInTimerStore.setState({
        timerStatuses: [{ TargetEntityId: '1', Status: 'Ok' }] as any,
        isLoadingStatuses: true,
        statusError: 'some error',
      });

      const { result } = renderHook(() => useCheckInTimerStore());

      act(() => {
        result.current.reset();
      });

      expect(result.current.timerStatuses).toEqual([]);
      expect(result.current.isLoadingStatuses).toBe(false);
      expect(result.current.statusError).toBeNull();
    });
  });
});
