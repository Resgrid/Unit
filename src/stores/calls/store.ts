import { create } from 'zustand';
import { CallResultData } from '@/models/v4/calls/callResultData';
import { CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { getCalls } from '@/api/calls/calls';
import { getCallPriorities } from '@/api/calls/callPriorities';

interface CallsState {
  calls: CallResultData[];
  callPriorities: CallPriorityResultData[];
  isLoading: boolean;
  error: string | null;
  fetchCalls: () => Promise<void>;
  fetchCallPriorities: () => Promise<void>;
  init: () => Promise<void>;
}

export const useCallsStore = create<CallsState>((set) => ({
  calls: [],
  callPriorities: [],
  isLoading: false,
  error: null,
  init: async () => {
    set({ isLoading: true, error: null });
    const callsResponse = await getCalls();
    const callPrioritiesresponse = await getCallPriorities();
    set({
      calls: callsResponse.Data,
      callPriorities: callPrioritiesresponse.Data,
      isLoading: false,
    });
  },
  fetchCalls: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getCalls();
      set({ calls: response.Data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch calls', isLoading: false });
    }
  },
  fetchCallPriorities: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getCallPriorities();
      set({ callPriorities: response.Data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch call priorities', isLoading: false });
    }
  },
}));
