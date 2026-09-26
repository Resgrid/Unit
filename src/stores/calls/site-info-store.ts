import { create } from 'zustand';

import { getCallSiteInfo } from '@/api/calls/callSiteInfo';
import { logger } from '@/lib/logging';
import { type CallSiteInfoData } from '@/models/v4/calls/callSiteInfoResult';

interface SiteInfoState {
  callId: string | null;
  siteInfo: CallSiteInfoData | null;
  isLoading: boolean;
  error: string | null;

  fetchSiteInfo: (callId: string) => Promise<void>;
  reset: () => void;
}

// Bumped by every fetch and every reset. The tab re-fetches the same call when the protected-data grant
// changes, so the call id alone cannot tell a stale answer apart: a slow pre-grant response could put
// REDACTED values back, or a slow granted one could keep revealed values on screen after the grant ends.
let requestSeq = 0;

/**
 * Site Info tab state (Contacts plan Phase A): the pre-plans, hazards, alert notes and files of the
 * contacts linked to the call being viewed. One call at a time; the tab re-fetches after a step-up so
 * REDACTED values are replaced by the revealed ones.
 */
export const useSiteInfoStore = create<SiteInfoState>((set, get) => ({
  callId: null,
  siteInfo: null,
  isLoading: false,
  error: null,

  fetchSiteInfo: async (callId: string) => {
    const seq = ++requestSeq;
    set({ isLoading: true, error: null, callId });
    try {
      const result = await getCallSiteInfo(callId);
      if (seq !== requestSeq || get().callId !== callId) {
        return; // stale response — a newer request (or a different call) is in charge now
      }
      set({ siteInfo: result.Data ?? null, isLoading: false });
    } catch (error) {
      if (seq !== requestSeq || get().callId !== callId) {
        return;
      }
      logger.error({
        message: 'Failed to fetch call site info',
        context: { error, callId },
      });
      set({
        siteInfo: null,
        error: error instanceof Error ? error.message : 'Failed to fetch call site info',
        isLoading: false,
      });
    }
  },

  reset: () => {
    requestSeq += 1;
    set({ callId: null, siteInfo: null, isLoading: false, error: null });
  },
}));
