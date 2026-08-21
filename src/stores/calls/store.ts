import { create } from 'zustand';

import { getCallPriorities } from '@/api/calls/callPriorities';
import { getCallExtraData, getCalls } from '@/api/calls/calls';
import { getCallTypes } from '@/api/calls/callTypes';
import { getNewCallData } from '@/api/dispatch/dispatch';
import { logger } from '@/lib/logging';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';
import { type CallTypeResultData } from '@/models/v4/callTypes/callTypeResultData';
import { type PoiResultData, type PoiTypeResultData } from '@/models/v4/mapping/poiResultData';

const DISPATCHES_TTL_MS = 5 * 60 * 1000; // refetch per-call dispatches after 5 min

interface CallsState {
  calls: CallResultData[];
  callPriorities: CallPriorityResultData[];
  callTypes: CallTypeResultData[];
  destinationPois: PoiResultData[];
  poiTypes: PoiTypeResultData[];
  callDispatches: Record<string, DispatchedEventResultData[]>;
  callDispatchesFetchedAt: Record<string, number>;
  isLoading: boolean;
  isInitialized: boolean;
  isCallFormDataLoaded: boolean;
  error: string | null;
  lastFetchedAt: number;
  fetchCalls: (forceRefresh?: boolean) => Promise<void>;
  fetchCallPriorities: () => Promise<void>;
  fetchCallTypes: () => Promise<void>;
  fetchCallFormData: () => Promise<void>;
  fetchCallDispatches: (callIds: string[]) => Promise<void>;
  init: () => Promise<void>;
}

export const useCallsStore = create<CallsState>((set, get) => ({
  calls: [],
  callPriorities: [],
  callTypes: [],
  destinationPois: [],
  poiTypes: [],
  callDispatches: {},
  callDispatchesFetchedAt: {},
  isLoading: false,
  isInitialized: false,
  isCallFormDataLoaded: false,
  error: null,
  lastFetchedAt: 0,
  init: async () => {
    // Prevent re-initialization during tree remounts
    if (get().isInitialized || get().isLoading) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
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
    } catch (error) {
      // isInitialized stays false so the TabLayout retry loop can call init() again;
      // isLoading must clear or the guard above would block every retry forever.
      logger.error({ message: 'Failed to initialize calls store', context: { error } });
      set({ error: 'Failed to initialize calls', isLoading: false });
    }
  },
  fetchCalls: async (forceRefresh = false) => {
    // Stale-while-revalidate: only show the blocking loader when there is nothing
    // to display yet — refreshes with data on screen happen in the background.
    if (get().calls.length === 0) {
      set({ isLoading: true, error: null });
    } else {
      set({ error: null });
    }
    try {
      const response = await getCalls(forceRefresh);
      const newCalls = Array.isArray(response.Data) ? response.Data : [];

      // Evict dispatches for calls no longer in the active list to prevent unbounded memory growth
      const activeIds = new Set(newCalls.map((c) => c.CallId));
      const existing = get().callDispatches;
      const existingFetchedAt = get().callDispatchesFetchedAt;
      const pruned: Record<string, DispatchedEventResultData[]> = {};
      const prunedFetchedAt: Record<string, number> = {};
      for (const id in existing) {
        if (activeIds.has(id)) {
          pruned[id] = existing[id];
          prunedFetchedAt[id] = existingFetchedAt[id] ?? 0;
        }
      }

      set({ calls: newCalls, callDispatches: pruned, callDispatchesFetchedAt: prunedFetchedAt, isLoading: false, lastFetchedAt: Date.now() });
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
    if (get().isCallFormDataLoaded) {
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
        isCallFormDataLoaded: true,
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch call form data', isLoading: false });
    }
  },
  fetchCallDispatches: async (callIds: string[]) => {
    const existing = get().callDispatches;
    const fetchedAt = get().callDispatchesFetchedAt;
    const now = Date.now();

    // Only fetch for call IDs that aren't cached or whose cache is stale.
    // Dispatches for an active call change over time, so an eternal cache
    // hides newly dispatched units/personnel.
    const uncachedIds = callIds.filter((id) => !(id in existing) || now - (fetchedAt[id] ?? 0) > DISPATCHES_TTL_MS);
    if (uncachedIds.length === 0) return;

    try {
      const results = await Promise.all(
        uncachedIds.map(async (callId) => {
          try {
            const result = await getCallExtraData(callId);
            const dispatches = result?.Data?.Dispatches ?? [];
            return { callId, dispatches: dispatches as DispatchedEventResultData[] };
          } catch {
            // Failed fetches must NOT be cached as empty — that would suppress
            // retries and hide dispatches for the life of the call.
            return { callId, dispatches: null };
          }
        })
      );

      const newDispatches: Record<string, DispatchedEventResultData[]> = {};
      const newFetchedAt: Record<string, number> = {};
      for (const { callId, dispatches } of results) {
        if (dispatches !== null) {
          newDispatches[callId] = dispatches;
          newFetchedAt[callId] = now;
        }
      }
      set({
        callDispatches: { ...get().callDispatches, ...newDispatches },
        callDispatchesFetchedAt: { ...get().callDispatchesFetchedAt, ...newFetchedAt },
      });
    } catch (error) {
      logger.warn({
        message: 'Failed to fetch call dispatches',
        context: { error },
      });
    }
  },
}));
