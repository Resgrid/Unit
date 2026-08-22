import { isAxiosError } from 'axios';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { getCheckInHistory, getTimersForCall, getTimerStatuses, performCheckIn, type PerformCheckInInput } from '@/api/check-in-timers/check-in-timers';
import { isClientCheckInTypeAllowed } from '@/lib/check-in-eligibility';
import { getCheckInTimerStatusSeverity } from '@/lib/check-in-timer-utils';
import { logger } from '@/lib/logging';
import type { CheckInRecordResultData } from '@/models/v4/checkIn/checkInRecordResultData';
import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';
import type { ResolvedCheckInTimerResultData } from '@/models/v4/checkIn/resolvedCheckInTimerResultData';
import { offlineEventManager } from '@/services/offline-event-manager.service';

export type CheckInResult = 'success' | 'queued' | 'failed';

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
  performCheckIn: (input: PerformCheckInInput) => Promise<CheckInResult>;
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
      const data = Array.isArray(result.Data) ? result.Data : [];
      const sorted = [...data].sort((a, b) => getCheckInTimerStatusSeverity(a.Status) - getCheckInTimerStatusSeverity(b.Status));
      set({ timerStatuses: sorted, isLoadingStatuses: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch timer statuses';
      // Polled every 30s while a call is open — a transient failure here is
      // retried on the next tick and must not flood Sentry.
      logger.warn({ message: 'Failed to fetch timer statuses', context: { error, callId } });
      set({ statusError: message, isLoadingStatuses: false });
    }
  },

  fetchResolvedTimers: async (callId: number) => {
    try {
      const result = await getTimersForCall(callId);
      set({ resolvedTimers: Array.isArray(result.Data) ? result.Data : [] });
    } catch (error) {
      logger.error({ message: 'Failed to fetch resolved timers', context: { error, callId } });
    }
  },

  fetchCheckInHistory: async (callId: number) => {
    set({ isLoadingHistory: true });
    try {
      const result = await getCheckInHistory(callId);
      set({ checkInHistory: Array.isArray(result.Data) ? result.Data : [], isLoadingHistory: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch check-in history', context: { error, callId } });
      set({ isLoadingHistory: false });
    }
  },

  performCheckIn: async (input: PerformCheckInInput) => {
    if (!isClientCheckInTypeAllowed(input.CheckInType)) {
      logger.warn({ message: 'Blocked unsupported IC check-in from Unit app', context: { callId: input.CallId } });
      set({ checkInError: 'IC check-ins are not supported in the Unit app', isCheckingIn: false });
      return 'failed';
    }

    set({ isCheckingIn: true, checkInError: null });
    try {
      await performCheckIn(input);
      set({ isCheckingIn: false });
      // Re-fetch statuses after successful check-in
      get().fetchTimerStatuses(input.CallId);
      return 'success' as CheckInResult;
    } catch (error) {
      const isOffline = isAxiosError(error) && (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED');
      if (isOffline) {
        offlineEventManager.queueCheckInEvent(input.CallId, input.CheckInType, input.UnitId, input.Latitude, input.Longitude, input.Note);
        logger.info({ message: 'Check-in queued for offline sync', context: { input } });
        set({ isCheckingIn: false });
        return 'queued' as CheckInResult;
      }
      const message = error instanceof Error ? error.message : 'Failed to perform check-in';
      logger.error({ message: 'Failed to perform check-in', context: { error, input } });
      set({ checkInError: message, isCheckingIn: false });
      return 'failed' as CheckInResult;
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
      // Skip while backgrounded — JS timers keep firing on Android and polling
      // would burn network/battery with no UI visible.
      if (AppState.currentState !== 'active') {
        return;
      }
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
