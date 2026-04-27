import { create } from 'zustand';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { logger } from '@/lib/logging';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type CustomStatusResultData } from '@/models/v4/customStatuses/customStatusResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PoiResultData, type PoiTypeResultData } from '@/models/v4/mapping/poiResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type SaveUnitStatusInput, type SaveUnitStatusRoleInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import { offlineEventManager } from '@/services/offline-event-manager.service';

import { useCoreStore } from '../app/core-store';
import { useLocationStore } from '../app/location-store';
import { useCallsStore } from '../calls/store';

type StatusStep = 'select-status' | 'select-destination' | 'add-note';
type DestinationType = 'none' | 'call' | 'station' | 'poi';

type StatusType = CustomStatusResultData | StatusesResultData;

const STORE_TTL_MS = 5 * 60 * 1000;

interface StatusBottomSheetStore {
  isOpen: boolean;
  currentStep: StatusStep;
  selectedCall: CallResultData | null;
  selectedStation: GroupResultData | null;
  selectedPoi: PoiResultData | null;
  selectedDestinationType: DestinationType;
  selectedStatus: StatusType | null;
  cameFromStatusSelection: boolean;
  note: string;
  availableCalls: CallResultData[];
  availableStations: GroupResultData[];
  availablePois: PoiResultData[];
  availablePoiTypes: PoiTypeResultData[];
  lastFetchedAt: number;
  isLoading: boolean;
  error: string | null;
  setIsOpen: (isOpen: boolean, status?: StatusType) => void;
  setCurrentStep: (step: StatusStep) => void;
  setSelectedCall: (call: CallResultData | null) => void;
  setSelectedStation: (station: GroupResultData | null) => void;
  setSelectedPoi: (poi: PoiResultData | null) => void;
  setSelectedDestinationType: (type: DestinationType) => void;
  setSelectedStatus: (status: StatusType | null) => void;
  setNote: (note: string) => void;
  fetchDestinationData: (unitId: string) => Promise<void>;
  reset: () => void;
}

const hasFreshDestinationData = (lastFetchedAt: number): boolean => {
  return lastFetchedAt > 0 && Date.now() - lastFetchedAt <= STORE_TTL_MS;
};

export const useStatusBottomSheetStore = create<StatusBottomSheetStore>((set, get) => ({
  isOpen: false,
  currentStep: 'select-destination',
  selectedCall: null,
  selectedStation: null,
  selectedPoi: null,
  selectedDestinationType: 'none',
  selectedStatus: null,
  cameFromStatusSelection: false,
  note: '',
  availableCalls: [],
  availableStations: [],
  availablePois: [],
  availablePoiTypes: [],
  lastFetchedAt: 0,
  isLoading: false,
  error: null,
  setIsOpen: (isOpen, status) => {
    if (!isOpen) {
      set({ isOpen: false });
      return;
    }

    if (!status) {
      set({
        isOpen,
        selectedStatus: null,
        currentStep: 'select-status',
        cameFromStatusSelection: true,
      });
      return;
    }

    set({
      isOpen,
      selectedStatus: status,
      currentStep: 'select-destination',
      cameFromStatusSelection: false,
    });
  },
  setCurrentStep: (step) => set({ currentStep: step }),
  setSelectedCall: (call) => set({ selectedCall: call }),
  setSelectedStation: (station) => set({ selectedStation: station }),
  setSelectedPoi: (poi) => set({ selectedPoi: poi }),
  setSelectedDestinationType: (type) => set({ selectedDestinationType: type }),
  setSelectedStatus: (status) => set({ selectedStatus: status }),
  setNote: (note) => set({ note }),
  fetchDestinationData: async (unitId: string) => {
    if (get().isLoading || hasFreshDestinationData(get().lastFetchedAt)) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await getSetUnitStatusData(unitId);
      const data = response.Data;
      const lastFetchedAt = Date.now();
      const availableCalls = data?.Calls ?? [];

      useCallsStore.setState({
        calls: availableCalls,
        lastFetchedAt,
      });

      set({
        availableCalls,
        availableStations: data?.Stations ?? [],
        availablePois: data?.DestinationPois ?? [],
        availablePoiTypes: data?.PoiTypes ?? [],
        lastFetchedAt,
        isLoading: false,
        error: null,
      });
    } catch {
      set({
        error: 'Failed to fetch destination data',
        isLoading: false,
      });
    }
  },
  reset: () =>
    set({
      isOpen: false,
      currentStep: 'select-destination',
      selectedCall: null,
      selectedStation: null,
      selectedPoi: null,
      selectedDestinationType: 'none',
      selectedStatus: null,
      cameFromStatusSelection: false,
      note: '',
      availableCalls: [],
      availableStations: [],
      availablePois: [],
      availablePoiTypes: [],
      lastFetchedAt: 0,
      isLoading: false,
      error: null,
    }),
}));

interface StatusesState {
  isLoading: boolean;
  error: string | null;
  saveUnitStatus: (input: SaveUnitStatusInput) => Promise<void>;
}

export const useStatusesStore = create<StatusesState>((set) => ({
  isLoading: false,
  error: null,
  saveUnitStatus: async (input: SaveUnitStatusInput) => {
    set({ isLoading: true, error: null });

    try {
      const date = new Date();
      input.Timestamp = date.toISOString();
      input.TimestampUtc = date.toUTCString().replace('UTC', 'GMT');

      if ((!input.Latitude && !input.Longitude) || (input.Latitude === '' && input.Longitude === '')) {
        const locationState = useLocationStore.getState();

        if (locationState.latitude !== null && locationState.longitude !== null) {
          input.Latitude = locationState.latitude.toString();
          input.Longitude = locationState.longitude.toString();
          input.Accuracy = locationState.accuracy?.toString() || '';
          input.Altitude = locationState.altitude?.toString() || '';
          input.AltitudeAccuracy = '';
          input.Speed = locationState.speed?.toString() || '';
          input.Heading = locationState.heading?.toString() || '';
        } else {
          input.Latitude = '';
          input.Longitude = '';
          input.Accuracy = '';
          input.Altitude = '';
          input.AltitudeAccuracy = '';
          input.Speed = '';
          input.Heading = '';
        }
      }

      try {
        await saveUnitStatus(input);

        set({ isLoading: false });

        logger.info({
          message: 'Unit status saved successfully',
          context: { unitId: input.Id, statusType: input.Type },
        });

        const activeUnit = useCoreStore.getState().activeUnit;
        if (activeUnit) {
          const refreshPromise = useCoreStore.getState().setActiveUnitWithFetch(activeUnit.UnitId);
          if (refreshPromise && typeof refreshPromise.catch === 'function') {
            refreshPromise.catch((error) => {
              logger.error({
                message: 'Failed to refresh unit data after status save',
                context: { unitId: activeUnit.UnitId, error },
              });
            });
          }
        }
      } catch (error) {
        logger.warn({
          message: 'Direct unit status save failed, queuing for offline processing',
          context: { unitId: input.Id, statusType: input.Type, error },
        });

        const roles =
          input.Roles?.map((role) => ({
            roleId: role.RoleId,
            userId: role.UserId,
          })) ?? [];

        let gpsData:
          | {
              latitude?: string;
              longitude?: string;
              accuracy?: string;
              altitude?: string;
              altitudeAccuracy?: string;
              speed?: string;
              heading?: string;
            }
          | undefined;

        if (input.Latitude && input.Longitude) {
          gpsData = {
            latitude: input.Latitude,
            longitude: input.Longitude,
            accuracy: input.Accuracy,
            altitude: input.Altitude,
            altitudeAccuracy: input.AltitudeAccuracy,
            speed: input.Speed,
            heading: input.Heading,
          };
        } else {
          const locationState = useLocationStore.getState();
          if (locationState.latitude !== null && locationState.longitude !== null) {
            gpsData = {
              latitude: locationState.latitude.toString(),
              longitude: locationState.longitude.toString(),
              accuracy: locationState.accuracy?.toString(),
              altitude: locationState.altitude?.toString(),
              altitudeAccuracy: undefined,
              speed: locationState.speed?.toString(),
              heading: locationState.heading?.toString(),
            };
          }
        }

        const eventId = offlineEventManager.queueUnitStatusEvent(
          input.Id,
          input.Type,
          input.Note || '',
          input.RespondingTo || '',
          input.RespondingToType,
          roles,
          gpsData
        );

        logger.info({
          message: 'Unit status queued for offline processing',
          context: { unitId: input.Id, statusType: input.Type, eventId },
        });

        set({ isLoading: false });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to process unit status update',
        context: { error },
      });
      set({ error: 'Failed to save unit status', isLoading: false });
      throw error;
    }
  },
}));
