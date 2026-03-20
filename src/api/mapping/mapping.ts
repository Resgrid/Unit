import { type FeatureCollection } from 'geojson';

import { getBaseApiUrl } from '@/lib/storage/app';
import { type GetMapDataAndMarkersResult } from '@/models/v4/mapping/getMapDataAndMarkersResult';
import { type GetMapLayersResult } from '@/models/v4/mapping/getMapLayersResult';
import {
  type GetAllActiveLayersResult,
  type GetCustomMapLayerResult,
  type GetCustomMapResult,
  type GetCustomMapsResult,
  type GetGeoJSONResult,
  type GetIndoorMapFloorResult,
  type GetIndoorMapResult,
  type GetIndoorMapsResult,
  type SearchAllMapFeaturesResult,
  type SearchCustomMapRegionsResult,
  type SearchIndoorLocationsResult,
} from '@/models/v4/mapping/mappingResults';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getMayLayersApi = createApiEndpoint('/Mapping/GetMayLayers');
const getMapDataAndMarkersApi = createApiEndpoint('/Mapping/GetMapDataAndMarkers');

// Indoor map endpoints
const getIndoorMapsApi = createCachedApiEndpoint('/Mapping/GetIndoorMaps', {
  ttl: 5 * 60 * 1000,
  enabled: true,
});
const getIndoorMapApi = createApiEndpoint('/Mapping/GetIndoorMap');
const getIndoorMapFloorApi = createApiEndpoint('/Mapping/GetIndoorMapFloor');
const getIndoorMapZonesGeoJSONApi = createApiEndpoint('/Mapping/GetIndoorMapZonesGeoJSON');
const searchIndoorLocationsApi = createApiEndpoint('/Mapping/SearchIndoorLocations');
const getNearbyIndoorMapsApi = createApiEndpoint('/Mapping/GetNearbyIndoorMaps');

// Custom map endpoints
const getCustomMapsApi = createCachedApiEndpoint('/Mapping/GetCustomMaps', {
  ttl: 5 * 60 * 1000,
  enabled: true,
});
const getCustomMapApi = createApiEndpoint('/Mapping/GetCustomMap');
const getCustomMapLayerApi = createApiEndpoint('/Mapping/GetCustomMapLayer');
const getMapLayerGeoJSONApi = createApiEndpoint('/Mapping/GetMapLayerGeoJSON');
const getCustomMapRegionsGeoJSONApi = createApiEndpoint('/Mapping/GetCustomMapRegionsGeoJSON');
const searchCustomMapRegionsApi = createApiEndpoint('/Mapping/SearchCustomMapRegions');

// Discovery endpoints
const getAllActiveLayersApi = createCachedApiEndpoint('/Mapping/GetAllActiveLayers', {
  ttl: 5 * 60 * 1000,
  enabled: true,
});
const searchAllMapFeaturesApi = createApiEndpoint('/Mapping/SearchAllMapFeatures');

// --- Existing Endpoints ---

export const getMapDataAndMarkers = async (signal?: AbortSignal) => {
  const response = await getMapDataAndMarkersApi.get<GetMapDataAndMarkersResult>(undefined, signal);
  return response.data;
};

export const getMayLayers = async (type: number, signal?: AbortSignal) => {
  const response = await getMayLayersApi.get<GetMapLayersResult>(
    {
      type: encodeURIComponent(type),
    },
    signal
  );
  return response.data;
};

// --- Indoor Maps ---

export const getIndoorMaps = async () => {
  const response = await getIndoorMapsApi.get<GetIndoorMapsResult>();
  return response.data;
};

export const getIndoorMap = async (mapId: string) => {
  const response = await getIndoorMapApi.get<GetIndoorMapResult>({
    id: encodeURIComponent(mapId),
  });
  return response.data;
};

export const getIndoorMapFloor = async (floorId: string) => {
  const response = await getIndoorMapFloorApi.get<GetIndoorMapFloorResult>({
    floorId: encodeURIComponent(floorId),
  });
  return response.data;
};

export const getIndoorMapZonesGeoJSON = async (floorId: string) => {
  const response = await getIndoorMapZonesGeoJSONApi.get<GetGeoJSONResult>({
    floorId: encodeURIComponent(floorId),
  });
  return response.data;
};

export const searchIndoorLocations = async (term: string, mapId?: string) => {
  const params: Record<string, unknown> = { term: encodeURIComponent(term) };
  if (mapId) {
    params.mapId = encodeURIComponent(mapId);
  }
  const response = await searchIndoorLocationsApi.get<SearchIndoorLocationsResult>(params);
  return response.data;
};

export const getNearbyIndoorMaps = async (lat: number, lon: number, radiusMeters: number) => {
  const response = await getNearbyIndoorMapsApi.get<GetIndoorMapsResult>({
    lat,
    lon,
    radiusMeters,
  });
  return response.data;
};

// --- Custom Maps ---

export const getCustomMaps = async (type?: number) => {
  const params: Record<string, unknown> = {};
  if (type !== undefined) {
    params.type = encodeURIComponent(type);
  }
  const response = await getCustomMapsApi.get<GetCustomMapsResult>(params);
  return response.data;
};

export const getCustomMap = async (mapId: string) => {
  const response = await getCustomMapApi.get<GetCustomMapResult>({
    id: encodeURIComponent(mapId),
  });
  return response.data;
};

export const getCustomMapLayer = async (layerId: string) => {
  const response = await getCustomMapLayerApi.get<GetCustomMapLayerResult>({
    layerId: encodeURIComponent(layerId),
  });
  return response.data;
};

export const getMapLayerGeoJSON = async (layerId: string) => {
  const response = await getMapLayerGeoJSONApi.get<GetGeoJSONResult>({
    layerId: encodeURIComponent(layerId),
  });
  return response.data;
};

export const getCustomMapRegionsGeoJSON = async (layerId: string) => {
  const response = await getCustomMapRegionsGeoJSONApi.get<GetGeoJSONResult>({
    layerId: encodeURIComponent(layerId),
  });
  return response.data;
};

export const searchCustomMapRegions = async (term: string, layerId?: string) => {
  const params: Record<string, unknown> = { term: encodeURIComponent(term) };
  if (layerId) {
    params.layerId = encodeURIComponent(layerId);
  }
  const response = await searchCustomMapRegionsApi.get<SearchCustomMapRegionsResult>(params);
  return response.data;
};

// --- Discovery & Search ---

export const getAllActiveLayers = async () => {
  const response = await getAllActiveLayersApi.get<GetAllActiveLayersResult>();
  return response.data;
};

export const searchAllMapFeatures = async (term: string, type?: 'all' | 'indoor' | 'custom') => {
  const params: Record<string, unknown> = { term: encodeURIComponent(term) };
  if (type) {
    params.type = type;
  }
  const response = await searchAllMapFeaturesApi.get<SearchAllMapFeaturesResult>(params);
  return response.data;
};

// --- URL Helpers (no fetch needed, constructs URLs for components) ---

export const getFloorImageUrl = (floorId: string): string => {
  return `${getBaseApiUrl()}/Mapping/GetIndoorMapFloorImage/${encodeURIComponent(floorId)}`;
};

export const getCustomMapLayerImageUrl = (layerId: string): string => {
  return `${getBaseApiUrl()}/Mapping/GetCustomMapLayerImage/${encodeURIComponent(layerId)}`;
};

export const getCustomMapTileUrl = (layerId: string): string => {
  return `${getBaseApiUrl()}/Mapping/GetCustomMapTile/${encodeURIComponent(layerId)}/{z}/{x}/{y}`;
};
