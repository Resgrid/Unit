import { create } from 'zustand';

import { getResourceIncidentView } from '@/api/calls/incidentCommand';
import { type ResourceIncidentView } from '@/models/v4/incidentCommand/resourceIncidentView';
import { INCIDENT_VIEW_STATUS_NOT_FOUND } from '@/models/v4/incidentCommand/resourceIncidentViewResult';
import { useCoreStore } from '@/stores/app/core-store';

interface IncidentCommandState {
  view: ResourceIncidentView | null;
  isLoading: boolean;
  error: string | null;
  fetchIncidentView: (callId: string) => Promise<void>;
  reset: () => void;
}

// Monotonic token guarding against stale async results: reset() and every new
// fetch bump it, so an in-flight request that has been superseded is discarded.
let requestSeq = 0;

export const useIncidentCommandStore = create<IncidentCommandState>((set) => ({
  view: null,
  isLoading: false,
  error: null,
  reset: () => {
    requestSeq++;
    set({
      view: null,
      isLoading: false,
      error: null,
    });
  },
  fetchIncidentView: async (callId: string) => {
    const seq = ++requestSeq;
    // Clear the previous call's view so it can never render for the new call.
    set({ view: null, isLoading: true, error: null });
    try {
      const activeUnitId = useCoreStore.getState().activeUnitId;
      const result = await getResourceIncidentView(callId, activeUnitId ?? undefined);
      if (seq !== requestSeq) return;

      if (result && result.Data && result.Status !== INCIDENT_VIEW_STATUS_NOT_FOUND) {
        set({
          view: result.Data,
          isLoading: false,
        });
      } else {
        // The call has no incident command established (Status === 'NotFound').
        set({
          view: null,
          isLoading: false,
        });
      }
    } catch (error) {
      if (seq !== requestSeq) return;
      set({
        view: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        isLoading: false,
      });
    }
  },
}));
