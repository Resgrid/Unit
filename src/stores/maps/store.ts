import { type FeatureCollection } from 'geojson';
import { create } from 'zustand';

import {
  getAllActiveLayers,
  getCustomMap,
  getCustomMaps,
  getIndoorMap,
  getIndoorMapFloor,
  getIndoorMapZonesGeoJSON,
  getIndoorMaps,
  getMapLayerGeoJSON,
  searchAllMapFeatures,
} from '@/api/mapping/mapping';
import { type CustomMapResultData } from '@/models/v4/mapping/customMapResultData';
import { type IndoorMapFloorResultData, type IndoorMapResultData } from '@/models/v4/mapping/indoorMapResultData';
import { type ActiveLayerSummary, type UnifiedSearchResultItem } from '@/models/v4/mapping/mappingResults';

interface MapsState {
  // Layer management
  activeLayers: ActiveLayerSummary[];
  layerToggles: Record<string, boolean>;
  cachedGeoJSON: Record<string, FeatureCollection>;

  // Indoor maps
  indoorMaps: IndoorMapResultData[];
  currentIndoorMap: IndoorMapResultData | null;
  currentFloorId: string | null;
  currentFloor: IndoorMapFloorResultData | null;
  currentZonesGeoJSON: FeatureCollection | null;

  // Custom maps
  customMaps: CustomMapResultData[];
  currentCustomMap: CustomMapResultData | null;

  // Search
  searchResults: UnifiedSearchResultItem[];
  searchQuery: string;

  // Loading states
  isLoading: boolean;
  isLoadingLayers: boolean;
  isLoadingGeoJSON: boolean;
  error: string | null;

  // Actions - Layer management
  fetchActiveLayers: () => Promise<void>;
  toggleLayer: (layerId: string) => void;
  fetchLayerGeoJSON: (layerId: string) => Promise<FeatureCollection | null>;

  // Actions - Indoor maps
  fetchIndoorMaps: () => Promise<void>;
  fetchIndoorMap: (mapId: string) => Promise<void>;
  setCurrentFloor: (floorId: string) => Promise<void>;

  // Actions - Custom maps
  fetchCustomMaps: (type?: number) => Promise<void>;
  fetchCustomMap: (mapId: string) => Promise<void>;

  // Actions - Search
  searchMapFeatures: (term: string, type?: 'all' | 'indoor' | 'custom') => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;

  // Actions - State management
  clearCurrentMap: () => void;
}

export const useMapsStore = create<MapsState>((set, get) => ({
  // Initial state
  activeLayers: [],
  layerToggles: {},
  cachedGeoJSON: {},
  indoorMaps: [],
  currentIndoorMap: null,
  currentFloorId: null,
  currentFloor: null,
  currentZonesGeoJSON: null,
  customMaps: [],
  currentCustomMap: null,
  searchResults: [],
  searchQuery: '',
  isLoading: false,
  isLoadingLayers: false,
  isLoadingGeoJSON: false,
  error: null,

  // --- Layer Management ---
  fetchActiveLayers: async () => {
    set({ isLoadingLayers: true, error: null });
    try {
      const response = await getAllActiveLayers();
      const layers = Array.isArray(response.Data) ? response.Data : [];
      const toggles: Record<string, boolean> = {};
      layers.forEach((layer) => {
        toggles[layer.LayerId] = layer.IsOnByDefault;
      });
      set({ activeLayers: layers, layerToggles: toggles, isLoadingLayers: false });
    } catch (error) {
      set({ error: 'Failed to fetch active layers', isLoadingLayers: false });
    }
  },

  toggleLayer: (layerId: string) => {
    const { layerToggles } = get();
    set({
      layerToggles: {
        ...layerToggles,
        [layerId]: !layerToggles[layerId],
      },
    });
  },

  fetchLayerGeoJSON: async (layerId: string) => {
    const { cachedGeoJSON } = get();
    if (cachedGeoJSON[layerId]) {
      return cachedGeoJSON[layerId];
    }

    set({ isLoadingGeoJSON: true });
    try {
      const response = await getMapLayerGeoJSON(layerId);
      const geoJSON = response.Data;
      set({
        cachedGeoJSON: { ...get().cachedGeoJSON, [layerId]: geoJSON },
        isLoadingGeoJSON: false,
      });
      return geoJSON;
    } catch (error) {
      set({ error: 'Failed to fetch layer GeoJSON', isLoadingGeoJSON: false });
      return null;
    }
  },

  // --- Indoor Maps ---
  fetchIndoorMaps: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getIndoorMaps();
      set({
        indoorMaps: Array.isArray(response.Data) ? response.Data : [],
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch indoor maps', isLoading: false });
    }
  },

  fetchIndoorMap: async (mapId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getIndoorMap(mapId);
      const map = response.Data;
      set({ currentIndoorMap: map, isLoading: false });

      // Auto-select first floor
      if (map?.Floors?.length > 0) {
        const sortedFloors = [...map.Floors].sort((a, b) => a.FloorOrder - b.FloorOrder);
        await get().setCurrentFloor(sortedFloors[0].IndoorMapFloorId);
      }
    } catch (error) {
      set({ error: 'Failed to fetch indoor map', isLoading: false });
    }
  },

  setCurrentFloor: async (floorId: string) => {
    set({ currentFloorId: floorId, isLoadingGeoJSON: true });
    try {
      const [floorResponse, zonesResponse] = await Promise.all([getIndoorMapFloor(floorId), getIndoorMapZonesGeoJSON(floorId)]);
      set({
        currentFloor: floorResponse.Data,
        currentZonesGeoJSON: zonesResponse.Data,
        isLoadingGeoJSON: false,
      });
    } catch (error) {
      set({ error: 'Failed to load floor data', isLoadingGeoJSON: false });
    }
  },

  // --- Custom Maps ---
  fetchCustomMaps: async (type?: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getCustomMaps(type);
      set({
        customMaps: Array.isArray(response.Data) ? response.Data : [],
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch custom maps', isLoading: false });
    }
  },

  fetchCustomMap: async (mapId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getCustomMap(mapId);
      set({ currentCustomMap: response.Data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch custom map', isLoading: false });
    }
  },

  // --- Search ---
  searchMapFeatures: async (term: string, type?: 'all' | 'indoor' | 'custom') => {
    set({ isLoading: true, error: null, searchQuery: term });
    try {
      const response = await searchAllMapFeatures(term, type);
      set({
        searchResults: Array.isArray(response.Data) ? response.Data : [],
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to search map features', isLoading: false });
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  clearSearch: () => set({ searchResults: [], searchQuery: '' }),

  // --- State Management ---
  clearCurrentMap: () =>
    set({
      currentIndoorMap: null,
      currentFloorId: null,
      currentFloor: null,
      currentZonesGeoJSON: null,
      currentCustomMap: null,
    }),
}));
