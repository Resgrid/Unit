import { create } from 'zustand';

import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { getUnits } from '@/api/units/units';
import { logger } from '@/lib/logging';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';
import { type UnitResultData } from '@/models/v4/units/unitResultData';

interface UnitsState {
  units: UnitResultData[];
  unitStatuses: UnitTypeStatusResultData[];
  isLoading: boolean;
  error: string | null;
  /** True once a fetch has finished, so callers can tell "not loaded yet" from "loaded, none found". */
  hasLoaded: boolean;
  fetchUnits: (forceRefresh?: boolean) => Promise<void>;
}

// Fetches can overlap: the picker opens while a retry is already in flight, or two consumers ask at
// once. Each fetch claims a generation and only writes if it is still the newest — otherwise a slow
// cached answer, or a late failure, lands on top of the fresher result that already arrived.
let fetchGeneration = 0;

export const useUnitsStore = create<UnitsState>((set) => ({
  units: [],
  unitStatuses: [],
  isLoading: false,
  error: null,
  hasLoaded: false,
  fetchUnits: async (forceRefresh = false) => {
    const generation = ++fetchGeneration;
    set({ isLoading: true, error: null });
    try {
      const unitsResponse = await getUnits(forceRefresh);
      const unitStatusesResponse = await getAllUnitStatuses();

      if (generation !== fetchGeneration) {
        // A newer fetch owns the state, including isLoading — it will clear that when it lands.
        return;
      }

      set({
        units: unitsResponse.Data ?? [],
        unitStatuses: unitStatusesResponse.Data ?? [],
        isLoading: false,
        hasLoaded: true,
      });
    } catch (error) {
      // The unit picker used to render this as "No units available", so a 401, a timeout or a server
      // fault all looked to the crew like the department simply had no units. Keep the failure.
      logger.error({
        message: 'Failed to fetch units',
        context: { error },
      });

      if (generation !== fetchGeneration) {
        // Reporting a superseded failure would replace the units a newer fetch just delivered.
        return;
      }

      set({
        error: error instanceof Error ? error.message : 'Failed to fetch units',
        isLoading: false,
        hasLoaded: true,
      });
    }
  },
}));
