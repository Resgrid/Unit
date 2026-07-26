import { Env } from '@env';
import find from 'lodash/find';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getConfig } from '@/api/config';
import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { getUnitStatus } from '@/api/units/unitStatuses';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';
import { getActiveCallId, getActiveUnitId, removeActiveCallId, removeActiveUnitId, setActiveCallId, setActiveUnitId } from '@/lib/storage/app';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';
import { type UnitResultData } from '@/models/v4/units/unitResultData';
import { type UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';
import { isNetworkError } from '@/utils/network';

import { useCallsStore } from '../calls/store';
//import { useRolesStore } from '../roles/store';
import { useUnitsStore } from '../units/store';

interface CoreState {
  activeUnitId: string | null;
  activeUnit: UnitResultData | null;
  activeUnitStatus: UnitStatusResultData | null;
  activeUnitStatusType: StatusesResultData | null;
  activeStatuses: UnitTypeStatusResultData | null;

  activeCallId: string | null;
  activeCall: CallResultData | null;
  activePriority: CallPriorityResultData | null;

  config: GetConfigResultData | null;

  isLoading: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  init: () => Promise<void>;
  setActiveUnit: (unitId: string) => void;
  setActiveUnitWithFetch: (unitId: string) => Promise<void>;
  refreshActiveUnitStatus: (unitId: string) => Promise<void>;
  setActiveCall: (callId: string | null) => Promise<void>;
  fetchConfig: () => Promise<void>;
}

export const useCoreStore = create<CoreState>()(
  persist(
    (set, get) => ({
      activeUnitId: null,
      activeUnit: null,
      activeUnitStatus: null,
      activeUnitStatusType: null,
      activeCallId: null,
      activeCall: null,
      activePriority: null,
      config: null,
      isLoading: false,
      isInitialized: false,
      isInitializing: false,
      error: null,
      activeStatuses: null,
      init: async () => {
        const state = get();

        // Prevent multiple simultaneous initializations
        if (state.isInitializing) {
          logger.info({
            message: 'Core store initialization already in progress, skipping',
          });
          return;
        }

        // Don't re-initialize if already initialized
        if (state.isInitialized) {
          logger.info({
            message: 'Core store already initialized, skipping',
          });
          return;
        }

        set({ isLoading: true, isInitializing: true, error: null });

        try {
          // Fetch config first before anything else - this is critical for SignalR connections
          await get().fetchConfig();

          // If config fetch failed, don't continue initialization
          if (get().error) {
            throw new Error('Config fetch failed, cannot continue initialization');
          }

          const activeUnitId = getActiveUnitId();
          const activeCallId = getActiveCallId();

          // Initialize in sequence to prevent race conditions
          if (activeUnitId) {
            await get().setActiveUnit(activeUnitId);
          }

          if (activeCallId) {
            await get().setActiveCall(activeCallId);
          }

          set({
            isInitialized: true,
            isLoading: false,
            isInitializing: false,
          });

          logger.info({
            message: 'Core store initialization completed successfully',
          });
        } catch (error) {
          set({
            error: 'Failed to init core app data',
            isLoading: false,
            isInitializing: false,
          });
          // A network failure here has already been surfaced by fetchConfig; keep it
          // at warn so the same transient, recoverable error is not reported to Sentry
          // multiple times as it bubbles up the call stack.
          if (isNetworkError(error)) {
            logger.warn({
              message: 'Failed to init core app data due to network connectivity',
              context: { error },
            });
          } else {
            logger.error({
              message: 'Failed to init core app data',
              context: { error },
            });
          }
          throw error;
        }
      },
      setActiveUnit: async (unitId: string) => {
        set({ isLoading: true, error: null, activeUnitId: unitId });
        try {
          await setActiveUnitId(unitId);
          await useUnitsStore.getState().fetchUnits();
          const units = useUnitsStore.getState().units;
          const unitStatuses = useUnitsStore.getState().unitStatuses;
          const activeUnit = units.find((unit) => unit.UnitId === unitId);
          if (activeUnit) {
            let activeStatuses: UnitTypeStatusResultData | undefined = undefined;
            const allStatuses = await getAllUnitStatuses();
            const defaultStatuses = find(allStatuses.Data, ['UnitType', '0']);

            if (activeUnit.Type) {
              const statusesForType = find(allStatuses.Data, ['UnitType', activeUnit.Type.toString()]);

              if (statusesForType) {
                activeStatuses = statusesForType;
              } else {
                activeStatuses = defaultStatuses;
              }
            } else {
              activeStatuses = defaultStatuses;
            }

            set({
              activeUnit: activeUnit,
              activeStatuses: activeStatuses,
              isLoading: false,
            });
          } else {
            // Persisted unit no longer exists (deleted/decommissioned) — clear
            // the stale id and ALWAYS reset isLoading or consumers spin forever.
            logger.warn({
              message: 'Active unit not found in fetched units, clearing stale selection',
              context: { unitId },
            });
            await removeActiveUnitId();
            set({
              activeUnitId: null,
              activeUnit: null,
              activeUnitStatus: null,
              activeUnitStatusType: null,
              activeStatuses: null,
              isLoading: false,
            });
            return;
          }

          const unitStatus = await getUnitStatus(unitId);

          if (unitStatus) {
            const unitStatusType = unitStatuses.find((status) => status.UnitType === activeUnit?.Type);
            if (unitStatusType) {
              const unitStatusInfo = unitStatusType.Statuses.find((status) => status.Text === unitStatus.Data.State);
              set({
                activeUnitStatus: unitStatus.Data,
                activeUnitStatusType: unitStatusInfo,
              });
            } else {
              set({
                activeUnitStatus: unitStatus.Data,
                activeUnitStatusType: null,
              });
            }
          }

          //await useRolesStore.getState().fetchRolesForUnit(unitId);
        } catch (error) {
          set({ error: 'Failed to set active unit', isLoading: false });
          logger.error({
            message: 'Failed to set active unit',
            context: { error },
          });
        }
      },
      setActiveUnitWithFetch: async (unitId: string) => {
        set({ isLoading: true, error: null, activeUnitId: unitId });
        try {
          await useUnitsStore.getState().fetchUnits();

          const units = useUnitsStore.getState().units;
          const activeUnit = units.find((unit) => unit.UnitId === unitId);

          const unitStatus = await getUnitStatus(unitId);

          set({
            activeUnit: activeUnit,
            activeUnitStatus: unitStatus.Data,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: 'Failed to fetch and set active unit',
            isLoading: false,
          });
          logger.error({
            message: 'Failed to fetch and set active unit',
            context: { error },
          });
        }
      },
      // Lightweight status-only refresh — used by the SignalR status hook so a
      // unitStatusUpdated event does NOT refetch the entire fleet.
      refreshActiveUnitStatus: async (unitId: string) => {
        try {
          const unitStatus = await getUnitStatus(unitId);
          if (unitStatus?.Data) {
            set({ activeUnitStatus: unitStatus.Data });
          }
        } catch (error) {
          logger.error({
            message: 'Failed to refresh active unit status',
            context: { error },
          });
        }
      },
      setActiveCall: async (callId: string | null) => {
        if (!callId) {
          // Deselect the call — also drop the persisted id so a stale value is
          // not re-attempted on every cold start.
          await removeActiveCallId();
          set({
            activeCall: null,
            activePriority: null,
            activeCallId: null,
          });
          return;
        }

        set({ isLoading: true, error: null, activeCallId: callId });
        try {
          await setActiveCallId(callId);
          const callStore = useCallsStore.getState();
          await callStore.fetchCalls();
          await callStore.fetchCallPriorities();
          const activeCall = callStore.calls.find((call) => call.CallId === callId);
          const activePriority = callStore.callPriorities.find((priority) => priority.Id === activeCall?.Priority);

          if (!activeCall) {
            // Call no longer active (e.g. closed between persist and init) —
            // clear the stale id instead of re-attempting it every cold start.
            await removeActiveCallId();
            set({
              activeCall: null,
              activePriority: null,
              activeCallId: null,
              isLoading: false,
            });
            return;
          }

          set({
            activeCall: activeCall,
            activePriority: activePriority,
            isLoading: false,
          });
        } catch (error) {
          set({ error: 'Failed to set active call', isLoading: false });
          logger.error({
            message: 'Failed to set active call',
            context: { error },
          });
        }
      },
      fetchConfig: async () => {
        try {
          const config = await getConfig(Env.APP_KEY);
          // Only update if config actually changed to prevent unnecessary re-renders
          const current = get().config;
          if (!current || JSON.stringify(current) !== JSON.stringify(config.Data)) {
            set({ config: config.Data, error: null });
          } else if (get().error) {
            // Clear error even if config hasn't changed
            set({ error: null });
          }
        } catch (error) {
          set({ error: 'Failed to fetch config', isLoading: false });
          // Transient connectivity failures (offline, or the app cold-launched in the
          // background with restricted network access) are expected and recoverable,
          // so log them at warn level to avoid flooding Sentry with non-actionable
          // errors. Genuine server responses (4xx/5xx) still report as errors.
          if (isNetworkError(error)) {
            logger.warn({
              message: 'Failed to fetch config due to network connectivity',
              context: { error },
            });
          } else {
            logger.error({
              message: 'Failed to fetch config',
              context: { error },
            });
          }
          throw error; // Re-throw to allow calling code to handle
        }
      },
    }),
    {
      name: 'core-storage',
      storage: createJSONStorage(() => zustandStorage),
      // Persist ONLY the selection ids. init() refetches everything else from
      // the server (and the standalone activeUnitId/activeCallId MMKV keys are
      // the real restore mechanism), so persisting full objects just meant
      // JSON.stringify + a synchronous MMKV write of heavy config/unit/call
      // payloads on EVERY store set.
      partialize: (state) => ({
        activeUnitId: state.activeUnitId,
        activeCallId: state.activeCallId,
      }),
    }
  )
);
