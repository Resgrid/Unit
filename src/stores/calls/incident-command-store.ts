import { create } from 'zustand';

import { getResourceIncidentView } from '@/api/calls/incidentCommand';
import { type ResourceIncidentView } from '@/models/v4/incidentCommand/resourceIncidentView';
import { useCoreStore } from '@/stores/app/core-store';

interface IncidentCommandState {
  view: ResourceIncidentView | null;
  isLoading: boolean;
  error: string | null;
  fetchIncidentView: (callId: string) => Promise<void>;
  reset: () => void;
}

export const useIncidentCommandStore = create<IncidentCommandState>((set) => ({
  view: null,
  isLoading: false,
  error: null,
  reset: () =>
    set({
      view: null,
      isLoading: false,
      error: null,
    }),
  fetchIncidentView: async (callId: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeUnitId = useCoreStore.getState().activeUnitId;
      const result = await getResourceIncidentView(callId, activeUnitId ?? undefined);

      if (result && result.Data && result.Status !== 'NotFound') {
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
      set({
        view: null,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        isLoading: false,
      });
    }
  },
}));
