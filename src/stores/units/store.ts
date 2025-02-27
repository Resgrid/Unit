import { create } from 'zustand';
import { createCachedApiEndpoint } from '@/api/common/cached-client';
import { ActiveCallsResult } from '@/models/v4/calls/activeCallsResult';
import { CallResultData } from '@/models/v4/calls/callResultData';
import { CallPrioritiesResult } from '@/models/v4/callPriorities/callPrioritiesResult';
import { CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { UnitTypeStatusesResult } from '@/models/v4/statuses/unitTypeStatusesResult';
import { UnitResultData } from '@/models/v4/units/unitResultData';
import { UnitsResult } from '@/models/v4/units/unitsResult';
import { getUnits } from '@/api/units/units';
import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';

interface UnitsState {
  units: UnitResultData[];
  unitStatuses: UnitTypeStatusResultData[];
  isLoading: boolean;
  error: string | null;
  fetchUnits: () => Promise<void>;
}

export const useUnitsStore = create<UnitsState>((set) => ({
  units: [],
  unitStatuses: [],
  isLoading: false,
  error: null,
  fetchUnits: async () => {
    set({ isLoading: true, error: null });
    try {
      const unitsResponse = await getUnits();
      const unitStatusesResponse = await getAllUnitStatuses();
      set({ units: unitsResponse.Data, unitStatuses: unitStatusesResponse.Data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch calls', isLoading: false });
    }
  },
})); 