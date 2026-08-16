import { type AxiosResponse } from 'axios';

const mockGet = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheRemove = jest.fn();
const mockCacheScopeIdentity = jest.fn(() => 'https://api.test_7_user-1');

jest.mock('@/api/common/client', () => ({
  createApiEndpoint: jest.fn(() => ({
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  cacheManager: {
    get: mockCacheGet,
    set: mockCacheSet,
    remove: mockCacheRemove,
    getScopeIdentity: mockCacheScopeIdentity,
  },
}));

type CachedEndpoint = {
  get: <T>(params?: Record<string, unknown>, options?: { forceRefresh?: boolean }) => Promise<AxiosResponse<T>>;
};

let createCachedApiEndpoint: (endpoint: string, cacheConfig?: { ttl?: number; enabled?: boolean }) => CachedEndpoint;

describe('createCachedApiEndpoint empty payload handling', () => {
  beforeAll(() => {
    // Required lazily so the mock factories above see initialized mock functions.
    createCachedApiEndpoint = require('@/api/common/cached-client').createCachedApiEndpoint;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockReturnValue(null);
  });

  it('does not cache a response whose body is a direct empty array', async () => {
    mockGet.mockResolvedValue({ data: [] });

    const api = createCachedApiEndpoint('/Units/GetAllUnits');
    const response = await api.get();

    expect(response.data).toEqual([]);
    expect(mockCacheSet).not.toHaveBeenCalled();
    expect(mockCacheRemove).toHaveBeenCalledWith('/Units/GetAllUnits', undefined);
  });

  it('evicts a previously cached non-empty answer when a direct empty array comes back', async () => {
    mockGet.mockResolvedValue({ data: [] });

    const api = createCachedApiEndpoint('/Units/GetAllUnits');
    await api.get({ departmentId: '7' }, { forceRefresh: true });

    expect(mockCacheSet).not.toHaveBeenCalled();
    expect(mockCacheRemove).toHaveBeenCalledWith('/Units/GetAllUnits', { departmentId: '7' });
  });

  it('caches a response whose body is a direct non-empty array', async () => {
    const rows = [{ UnitId: '1' }];
    mockGet.mockResolvedValue({ data: rows });

    const api = createCachedApiEndpoint('/Units/GetAllUnits', { enabled: true, ttl: 1000 });
    await api.get();

    expect(mockCacheRemove).not.toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalledWith('/Units/GetAllUnits', rows, undefined, 1000);
  });
});
