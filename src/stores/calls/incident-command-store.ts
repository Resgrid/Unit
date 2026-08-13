import { create } from 'zustand';

import { getResourceIncidentView } from '@/api/calls/incidentCommand';
import { logger } from '@/lib/logging';
import { type ResourceIncidentView } from '@/models/v4/incidentCommand/resourceIncidentView';
import { INCIDENT_VIEW_STATUS_NOT_FOUND } from '@/models/v4/incidentCommand/resourceIncidentViewResult';
import { useCoreStore } from '@/stores/app/core-store';

interface IncidentCommandState {
  view: ResourceIncidentView | null;
  isLoading: boolean;
  error: string | null;
  /** The call whose incident view is loaded, so realtime updates can be matched to it. */
  callId: string | null;
  fetchIncidentView: (callId: string) => Promise<void>;
  /**
   * Realtime refresh for the call being viewed. Unlike fetchIncidentView this keeps the current view
   * on screen while refetching — the IC moving resources should update the panel in place rather
   * than blanking it and flashing a spinner on every change.
   */
  handleIncidentCommandUpdated: (callId: string) => void;
  reset: () => void;
}

// Monotonic token guarding against stale async results: reset() and every new
// fetch bump it, so an in-flight request that has been superseded is discarded.
let requestSeq = 0;

export const useIncidentCommandStore = create<IncidentCommandState>((set, get) => ({
  view: null,
  isLoading: false,
  error: null,
  callId: null,
  reset: () => {
    requestSeq++;
    set({
      view: null,
      isLoading: false,
      error: null,
      callId: null,
    });
  },
  handleIncidentCommandUpdated: (callId: string) => {
    const state = get();
    if (!state.callId || state.callId !== String(callId)) {
      return;
    }

    const seq = ++requestSeq;
    void (async () => {
      try {
        const activeUnitId = useCoreStore.getState().activeUnitId;
        const result = await getResourceIncidentView(callId, activeUnitId ?? undefined);
        if (seq !== requestSeq) return;
        set({ view: result && result.Data && result.Status !== INCIDENT_VIEW_STATUS_NOT_FOUND ? result.Data : null, error: null });
      } catch (error) {
        if (seq !== requestSeq) return;
        // A failed background refresh must not wipe the view the crew is reading.
        logger.warn({ message: 'IncidentCommand: realtime refresh failed', context: { callId, error } });
      }
    })();
  },
  fetchIncidentView: async (callId: string) => {
    const seq = ++requestSeq;
    // Clear the previous call's view so it can never render for the new call.
    set({ view: null, isLoading: true, error: null, callId: String(callId) });
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
