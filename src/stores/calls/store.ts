import { create } from 'zustand';

import { getCallPriorities } from '@/api/calls/callPriorities';
import { getCalls } from '@/api/calls/calls';
import { getCallTypes } from '@/api/calls/callTypes';
import { getNewCallData } from '@/api/dispatch/dispatch';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type CallTypeResultData } from '@/models/v4/callTypes/callTypeResultData';
import { type PoiResultData, type PoiTypeResultData } from '@/models/v4/mapping/poiResultData';

interface CallsState {
  calls: CallResultData[];
  callPriorities: CallPriorityResultData[];
  callTypes: CallTypeResultData[];
  destinationPois: PoiResultData[];
  poiTypes: PoiTypeResultData[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  lastFetchedAt: number;
  fetchCalls: () => Promise<void>;
  fetchCallPriorities: () => Promise<void>;
  fetchCallTypes: () => Promise<void>;
  fetchCallFormData: () => Promise<void>;
  init: () => Promise<void>;
}

export const useCallsStore = create<CallsState>((set, get) => ({
  calls: [],
  callPriorities: [],
  callTypes: [],
  destinationPois: [],
  poiTypes: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  lastFetchedAt: 0,
  init: async () => {
    // Prevent re-initialization during tree remounts
    if (get().isInitialized || get().isLoading) {
      return;
    }
    set({ isLoading: true, error: null });
    const callsResponse = await getCalls();
    const callPrioritiesResponse = await getCallPriorities();
    const callTypesResponse = await getCallTypes();
    set({
      calls: Array.isArray(callsResponse.Data) ? callsResponse.Data : [],
      callPriorities: Array.isArray(callPrioritiesResponse.Data) ? callPrioritiesResponse.Data : [],
      callTypes: Array.isArray(callTypesResponse.Data) ? callTypesResponse.Data : [],
      isLoading: false,
      isInitialized: true,
      lastFetchedAt: Date.now(),
    });
  },
  fetchCalls: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getCalls();
      set({ calls: Array.isArray(response.Data) ? response.Data : [], isLoading: false, lastFetchedAt: Date.now() });
    } catch (error) {
      set({ error: 'Failed to fetch calls', isLoading: false });
    }
  },
  fetchCallPriorities: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getCallPriorities();
      set({ callPriorities: Array.isArray(response.Data) ? response.Data : [], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch call priorities', isLoading: false });
    }
  },
  fetchCallTypes: async () => {
    // Only fetch if we don't have call types in the store
    const { callTypes } = get();
    if (callTypes.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await getCallTypes();
      set({ callTypes: Array.isArray(response.Data) ? response.Data : [], isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch call types', isLoading: false });
    }
  },
  fetchCallFormData: async () => {
    const { callPriorities, callTypes, destinationPois, poiTypes } = get();
    if (callPriorities.length > 0 && callTypes.length > 0 && destinationPois.length > 0 && poiTypes.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await getNewCallData();
      const data = response.Data;
      set({
        callPriorities: Array.isArray(data?.Priorities) ? data.Priorities : [],
        callTypes: Array.isArray(data?.CallTypes) ? data.CallTypes : [],
        destinationPois: Array.isArray(data?.DestinationPois) ? data.DestinationPois : [],
        poiTypes: Array.isArray(data?.PoiTypes) ? data.PoiTypes : [],
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch call form data', isLoading: false });
    }
  },
}));
