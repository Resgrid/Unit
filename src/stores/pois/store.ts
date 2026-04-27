import { create } from 'zustand';

import { getPoi, getPois, getPoiTypes } from '@/api/mapping/mapping';
import { type PoiResultData, type PoiTypeResultData } from '@/models/v4/mapping/poiResultData';

const STORE_TTL_MS = 5 * 60 * 1000;

const mergePoiDetails = (existingPois: Record<number, PoiResultData>, pois: PoiResultData[]): Record<number, PoiResultData> => {
  return pois.reduce<Record<number, PoiResultData>>((accumulator, poi) => {
    accumulator[poi.PoiId] = poi;
    return accumulator;
  }, { ...existingPois });
};

interface PoisState {
  poiTypes: PoiTypeResultData[];
  pois: PoiResultData[];
  destinationPois: PoiResultData[];
  poiDetails: Record<number, PoiResultData>;
  selectedPoi: PoiResultData | null;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;
  lastFetchedAt: number;
  fetchPoiTypes: (force?: boolean) => Promise<PoiTypeResultData[]>;
  fetchDestinationPois: (force?: boolean) => Promise<PoiResultData[]>;
  fetchAllPoiData: (force?: boolean) => Promise<void>;
  fetchPoi: (poiId: number | string, force?: boolean) => Promise<PoiResultData | null>;
  clearSelectedPoi: () => void;
  clearError: () => void;
}

export const usePoisStore = create<PoisState>((set, get) => ({
  poiTypes: [],
  pois: [],
  destinationPois: [],
  poiDetails: {},
  selectedPoi: null,
  isLoading: false,
  isLoadingDetail: false,
  error: null,
  lastFetchedAt: 0,
  fetchPoiTypes: async (force = false) => {
    const { poiTypes, lastFetchedAt } = get();
    const isFresh = poiTypes.length > 0 && Date.now() - lastFetchedAt < STORE_TTL_MS;
    if (!force && isFresh) {
      return poiTypes;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await getPoiTypes();
      const nextPoiTypes = Array.isArray(response.Data) ? response.Data : [];
      set({ poiTypes: nextPoiTypes, isLoading: false, lastFetchedAt: Date.now() });
      return nextPoiTypes;
    } catch (error) {
      set({ error: 'Failed to fetch POI types', isLoading: false });
      return [];
    }
  },
  fetchDestinationPois: async (force = false) => {
    const { destinationPois, lastFetchedAt } = get();
    const isFresh = destinationPois.length > 0 && Date.now() - lastFetchedAt < STORE_TTL_MS;
    if (!force && isFresh) {
      return destinationPois;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await getPois(undefined, true);
      const nextDestinationPois = Array.isArray(response.Data) ? response.Data : [];
      set((state) => ({
        destinationPois: nextDestinationPois,
        poiDetails: mergePoiDetails(state.poiDetails, nextDestinationPois),
        isLoading: false,
        lastFetchedAt: Date.now(),
      }));
      return nextDestinationPois;
    } catch (error) {
      set({ error: 'Failed to fetch destination POIs', isLoading: false });
      return [];
    }
  },
  fetchAllPoiData: async (force = false) => {
    const { poiTypes, pois, destinationPois, lastFetchedAt } = get();
    const isFresh = poiTypes.length > 0 && pois.length > 0 && destinationPois.length > 0 && Date.now() - lastFetchedAt < STORE_TTL_MS;

    if (!force && isFresh) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const [poiTypesResponse, poisResponse, destinationPoisResponse] = await Promise.all([getPoiTypes(), getPois(undefined, false), getPois(undefined, true)]);
      const nextPoiTypes = Array.isArray(poiTypesResponse.Data) ? poiTypesResponse.Data : [];
      const nextPois = Array.isArray(poisResponse.Data) ? poisResponse.Data : [];
      const nextDestinationPois = Array.isArray(destinationPoisResponse.Data) ? destinationPoisResponse.Data : [];

      set((state) => ({
        poiTypes: nextPoiTypes,
        pois: nextPois,
        destinationPois: nextDestinationPois,
        poiDetails: mergePoiDetails(state.poiDetails, [...nextPois, ...nextDestinationPois]),
        isLoading: false,
        lastFetchedAt: Date.now(),
      }));
    } catch (error) {
      set({ error: 'Failed to fetch POIs', isLoading: false });
    }
  },
  fetchPoi: async (poiId: number | string, force = false) => {
    const normalizedPoiId = Number(poiId);
    const cachedPoi = get().poiDetails[normalizedPoiId];

    if (!force && cachedPoi) {
      set({ selectedPoi: cachedPoi });
      return cachedPoi;
    }

    set({ isLoadingDetail: true, error: null });
    try {
      const response = await getPoi(normalizedPoiId);
      const poi = response.Data;

      if (!poi || !poi.PoiId) {
        set({ selectedPoi: null, isLoadingDetail: false });
        return null;
      }

      set((state) => ({
        selectedPoi: poi,
        poiDetails: mergePoiDetails(state.poiDetails, [poi]),
        isLoadingDetail: false,
      }));

      return poi;
    } catch (error) {
      set({ error: 'Failed to fetch POI', isLoadingDetail: false });
      return null;
    }
  },
  clearSelectedPoi: () => set({ selectedPoi: null }),
  clearError: () => set({ error: null }),
}));
