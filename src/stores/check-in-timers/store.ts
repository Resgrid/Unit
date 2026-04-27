import { create } from 'zustand';

import { getCheckInHistory, getTimersForCall, getTimerStatuses, performCheckIn, type PerformCheckInInput } from '@/api/check-in-timers/check-in-timers';
import { logger } from '@/lib/logging';
import type { CheckInRecordResultData } from '@/models/v4/checkIn/checkInRecordResultData';
import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';
import type { ResolvedCheckInTimerResultData } from '@/models/v4/checkIn/resolvedCheckInTimerResultData';
import { offlineEventManager } from '@/services/offline-event-manager.service';

const STATUS_SEVERITY: Record<string, number> = {
  Overdue: 0,
  Warning: 1,
  Ok: 2,
};

interface CheckInTimerState {
  timerStatuses: CheckInTimerStatusResultData[];
  resolvedTimers: ResolvedCheckInTimerResultData[];
  checkInHistory: CheckInRecordResultData[];
  isLoadingStatuses: boolean;
  isLoadingHistory: boolean;
  isCheckingIn: boolean;
  statusError: string | null;
  checkInError: string | null;
  _pollingInterval: ReturnType<typeof setInterval> | null;

  fetchTimerStatuses: (callId: number) => Promise<void>;
  fetchResolvedTimers: (callId: number) => Promise<void>;
  fetchCheckInHistory: (callId: number) => Promise<void>;
  performCheckIn: (input: PerformCheckInInput) => Promise<boolean>;
  startPolling: (callId: number, intervalMs?: number) => void;
  stopPolling: () => void;
  reset: () => void;
}

const initialState = {
  timerStatuses: [],
  resolvedTimers: [],
  checkInHistory: [],
  isLoadingStatuses: false,
  isLoadingHistory: false,
  isCheckingIn: false,
  statusError: null,
  checkInError: null,
  _pollingInterval: null,
};

export const useCheckInTimerStore = create<CheckInTimerState>((set, get) => ({
  ...initialState,

  fetchTimerStatuses: async (callId: number) => {
    set({ isLoadingStatuses: true, statusError: null });
    try {
      const result = await getTimerStatuses(callId);
      const sorted = [...result.Data].sort((a, b) => (STATUS_SEVERITY[a.Status] ?? 3) - (STATUS_SEVERITY[b.Status] ?? 3));
      set({ timerStatuses: sorted, isLoadingStatuses: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch timer statuses';
      logger.error({ message: 'Failed to fetch timer statuses', context: { error, callId } });
      set({ statusError: message, isLoadingStatuses: false });
    }
  },

  fetchResolvedTimers: async (callId: number) => {
    try {
      const result = await getTimersForCall(callId);
      set({ resolvedTimers: result.Data });
    } catch (error) {
      logger.error({ message: 'Failed to fetch resolved timers', context: { error, callId } });
    }
  },

  fetchCheckInHistory: async (callId: number) => {
    set({ isLoadingHistory: true });
    try {
      const result = await getCheckInHistory(callId);
      set({ checkInHistory: result.Data, isLoadingHistory: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch check-in history', context: { error, callId } });
      set({ isLoadingHistory: false });
    }
  },

  performCheckIn: async (input: PerformCheckInInput) => {
    set({ isCheckingIn: true, checkInError: null });
    try {
      await performCheckIn(input);
      set({ isCheckingIn: false });
      // Re-fetch statuses after successful check-in
      get().fetchTimerStatuses(input.CallId);
      return true;
    } catch (error) {
      const isNetworkError = error instanceof Error && (error.message.includes('Network') || error.message.includes('timeout'));
      if (isNetworkError) {
        // Queue offline
        offlineEventManager.queueCheckInEvent(input.CallId, input.CheckInType, input.UnitId, input.Latitude, input.Longitude, input.Note);
        logger.info({ message: 'Check-in queued offline', context: { input } });
        set({ isCheckingIn: false });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to perform check-in';
      logger.error({ message: 'Failed to perform check-in', context: { error, input } });
      set({ checkInError: message, isCheckingIn: false });
      return false;
    }
  },

  startPolling: (callId: number, intervalMs: number = 30000) => {
    const { _pollingInterval } = get();
    if (_pollingInterval) {
      clearInterval(_pollingInterval);
    }

    // Fetch immediately
    get().fetchTimerStatuses(callId);

    const interval = setInterval(() => {
      get().fetchTimerStatuses(callId);
    }, intervalMs);

    set({ _pollingInterval: interval });
  },

  stopPolling: () => {
    const { _pollingInterval } = get();
    if (_pollingInterval) {
      clearInterval(_pollingInterval);
      set({ _pollingInterval: null });
    }
  },

  reset: () => {
    const { _pollingInterval } = get();
    if (_pollingInterval) {
      clearInterval(_pollingInterval);
    }
    set({ ...initialState });
  },
}));
