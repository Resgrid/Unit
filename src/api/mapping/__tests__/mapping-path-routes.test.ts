// Id-scoped endpoints are created per call, so responses are looked up by path when each endpoint is made.
jest.mock('../../common/client', () => {
  const endpoints: Record<string, { get: jest.Mock }> = {};
  const responses: Record<string, unknown> = {};
  return {
    __endpoints: endpoints,
    __responses: responses,
    createApiEndpoint: (path: string) => {
      const api = { get: jest.fn().mockResolvedValue({ data: path in responses ? responses[path] : { Data: {} } }) };
      endpoints[path] = api;
      return api;
    },
  };
});

jest.mock('../../common/cached-client', () => {
  const endpoints: Record<string, { get: jest.Mock }> = {};
  return {
    __endpoints: endpoints,
    createCachedApiEndpoint: (path: string) => {
      const api = { get: jest.fn().mockResolvedValue({ data: { Data: {} } }) };
      endpoints[path] = api;
      return api;
    },
  };
});

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: () => 'https://api.example.test/api/v4',
}));

import { getCustomMap, getCustomMapLayer, getCustomMapRegionsGeoJSON, getIndoorMap, getIndoorMapFloor, getIndoorMapZonesGeoJSON, getMapLayerGeoJSON, getPoi } from '../mapping';

const mockClient = jest.requireMock('../../common/client') as { __endpoints: Record<string, { get: jest.Mock }>; __responses: Record<string, unknown> };
const mockEndpoints = mockClient.__endpoints;
const mockResponses = mockClient.__responses;
const mockCachedEndpoints: Record<string, { get: jest.Mock }> = jest.requireMock('../../common/cached-client').__endpoints;

const featureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { name: 'Zone A' } }] };

describe('mapping id-scoped routes', () => {
  it('never creates the id-less query-string routes', () => {
    const created = [...Object.keys(mockEndpoints), ...Object.keys(mockCachedEndpoints)];
    ['GetPoi', 'GetIndoorMap', 'GetIndoorMapFloor', 'GetCustomMap', 'GetCustomMapLayer', 'GetMapLayerGeoJSON', 'GetIndoorMapZonesGeoJSON', 'GetCustomMapRegionsGeoJSON'].forEach((action) => {
      expect(created).not.toContain(`/Mapping/${action}`);
    });
  });

  it('puts the POI id in the GetPoi path', async () => {
    await getPoi(15);

    expect(mockCachedEndpoints['/Mapping/GetPoi/15'].get).toHaveBeenCalledWith();
  });

  it.each([
    ['GetIndoorMap', getIndoorMap],
    ['GetIndoorMapFloor', getIndoorMapFloor],
    ['GetCustomMap', getCustomMap],
    ['GetCustomMapLayer', getCustomMapLayer],
  ])('puts the id in the %s path', async (action, call) => {
    await call('a/b c');

    expect(mockEndpoints[`/Mapping/${action}/a%2Fb%20c`].get).toHaveBeenCalledWith();
  });

  it.each([
    ['GetMapLayerGeoJSON', getMapLayerGeoJSON],
    ['GetIndoorMapZonesGeoJSON', getIndoorMapZonesGeoJSON],
    ['GetCustomMapRegionsGeoJSON', getCustomMapRegionsGeoJSON],
  ])('puts the id in the %s path and wraps the raw FeatureCollection in Data', async (action, call) => {
    const path = `/Mapping/${action}/layer-1`;
    mockResponses[path] = featureCollection;

    const result = await call('layer-1');

    expect(mockEndpoints[path].get).toHaveBeenCalledWith();
    expect(result.Data).toEqual(featureCollection);
  });

  it('falls back to an empty FeatureCollection when the body has no features', async () => {
    mockResponses['/Mapping/GetMapLayerGeoJSON/empty-layer'] = '';

    const result = await getMapLayerGeoJSON('empty-layer');

    expect(result.Data).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
