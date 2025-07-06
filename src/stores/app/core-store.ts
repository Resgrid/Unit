import { Env } from '@env';
import _ from 'lodash';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getConfig } from '@/api/config/config';
import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { getUnitStatus } from '@/api/units/unitStatuses';
import { logger } from '@/lib/logging';
import { zustandStorage } from '@/lib/storage';
import { getActiveCallId, getActiveUnitId, setActiveCallId, setActiveUnitId } from '@/lib/storage/app';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';
import { type UnitResultData } from '@/models/v4/units/unitResultData';
import { type UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

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
          logger.error({
            message: `Failed to init core app data: ${JSON.stringify(error)}`,
            context: { error },
          });
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
            const defaultStatuses = _.find(allStatuses.Data, ['UnitType', '0']);

            if (activeUnit.Type) {
              const statusesForType = _.find(allStatuses.Data, ['UnitType', activeUnit.Type.toString()]);

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
            message: `Failed to set active unit: ${JSON.stringify(error)}`,
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
            message: `Failed to fetch and set active unit: ${JSON.stringify(error)}`,
            context: { error },
          });
        }
      },
      setActiveCall: async (callId: string | null) => {
        if (!callId) {
          // Deselect the call
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
          set({
            activeCall: activeCall,
            activePriority: activePriority,
            isLoading: false,
          });
        } catch (error) {
          set({ error: 'Failed to set active call', isLoading: false });
          logger.error({
            message: `Failed to set active call: ${JSON.stringify(error)}`,
            context: { error },
          });
        }
      },
      fetchConfig: async () => {
        try {
          const config = await getConfig(Env.APP_KEY);
          set({ config: config.Data });
        } catch (error) {
          set({ error: 'Failed to fetch config', isLoading: false });
          logger.error({
            message: `Failed to fetch config: ${JSON.stringify(error)}`,
            context: { error },
          });
        }
      },
    }),
    {
      name: 'core-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
