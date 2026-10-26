import { createCachedApiEndpoint } from '../../common/cached-client';
import { createApiEndpoint } from '../../common/client';
import { getMapIconLegend } from '../mapping';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  return {
    // Each endpoint reports its own path with the call, so a test can tell which endpoint was hit.
    createApiEndpoint: jest.fn((endpoint: string) => ({ get: (...args: unknown[]) => get(endpoint, ...args) })),
    __mockGet: get,
  };
});

jest.mock('../../common/cached-client', () => ({
  createCachedApiEndpoint: jest.fn(() => ({ get: jest.fn() })),
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.example.test/api/v4'),
}));

const { __mockGet: mockGet } = jest.requireMock('../../common/client') as { __mockGet: jest.Mock };

// Endpoints are created at module load; capture them before beforeEach clears the mocks.
const plainPaths = (createApiEndpoint as jest.Mock).mock.calls.map((call) => call[0]);
const cachedPaths = (createCachedApiEndpoint as jest.Mock).mock.calls.map((call) => call[0]);

describe('getMapIconLegend', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('targets Mapping/GetMapIconLegend without the response cache, so every open asks the server', () => {
    expect(plainPaths).toContain('/Mapping/GetMapIconLegend');
    expect(cachedPaths).not.toContain('/Mapping/GetMapIconLegend');
  });

  it('GETs the endpoint with no parameters and returns the v4 envelope as sent', async () => {
    const payload = {
      PageSize: 3,
      Status: 'success',
      Environment: 'test',
      RequestId: 'abc',
      Version: 'v4',
      Timestamp: '2026-10-25T00:00:00Z',
      Node: 'n1',
      Data: { StatusStyles: [], PriorityStyles: [], Calls: [{ Id: null, Name: 'Calls with no type', States: [] }], Units: [], Personnel: [], PoiTypes: [] },
    };
    mockGet.mockResolvedValueOnce({ data: payload });

    await expect(getMapIconLegend()).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/Mapping/GetMapIconLegend', undefined, undefined);
  });

  it('forwards the abort signal', async () => {
    const controller = new AbortController();
    mockGet.mockResolvedValueOnce({ data: { Data: null } });

    await getMapIconLegend(controller.signal);

    expect(mockGet).toHaveBeenCalledWith('/Mapping/GetMapIconLegend', undefined, controller.signal);
  });

  it('passes request failures to the caller', async () => {
    mockGet.mockRejectedValueOnce(new Error('Request failed with status code 404'));

    await expect(getMapIconLegend()).rejects.toThrow('404');
  });
});
