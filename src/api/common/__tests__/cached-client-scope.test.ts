import { type AxiosResponse } from 'axios';

const mockGet = jest.fn();
const mockStorageSet = jest.fn();
const mockStorageGetString = jest.fn();
const mockStorageDelete = jest.fn();
const mockGetBaseApiUrl = jest.fn();
const mockGetCacheScopeKey = jest.fn();

jest.mock('@/api/common/client', () => ({
  createApiEndpoint: jest.fn(() => ({
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('@/lib/storage', () => ({
  storage: {
    set: mockStorageSet,
    getString: mockStorageGetString,
    delete: mockStorageDelete,
    getAllKeys: jest.fn(() => []),
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: mockGetBaseApiUrl,
}));

jest.mock('@/lib/cache/cache-scope', () => ({
  getCacheScopeKey: mockGetCacheScopeKey,
}));

type CachedEndpoint = {
  get: <T>(params?: Record<string, unknown>, options?: { forceRefresh?: boolean }) => Promise<AxiosResponse<T>>;
};

let createCachedApiEndpoint: (endpoint: string, cacheConfig?: { ttl?: number; enabled?: boolean }) => CachedEndpoint;

const ENDPOINT = '/Units/GetAllUnits';
const USER_ONE_KEY = `api_cache_https://api.test_7_user-1_${ENDPOINT}`;
const USER_TWO_KEY = `api_cache_https://api.test_9_user-2_${ENDPOINT}`;

/** Resolves the pending api.get by hand, so the scope can move while the request is in flight. */
const pendingResponse = <T>() => {
  let settle: (value: { data: T }) => void = () => undefined;
  mockGet.mockReturnValue(
    new Promise<{ data: T }>((resolve) => {
      settle = resolve;
    })
  );

  return { settle: (data: T) => settle({ data }) };
};

describe('createCachedApiEndpoint cache scope changes mid-request', () => {
  beforeAll(() => {
    // Required lazily so the mock factories above see initialized mock functions.
    createCachedApiEndpoint = require('@/api/common/cached-client').createCachedApiEndpoint;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageGetString.mockReturnValue(undefined);
    mockGetBaseApiUrl.mockReturnValue('https://api.test');
    mockGetCacheScopeKey.mockReturnValue('7_user-1');
  });

  it('does not store a response under the new identity when the signed-in user changes while it is pending', async () => {
    const rows = [{ UnitId: '1' }];
    const request = pendingResponse<typeof rows>();

    const api = createCachedApiEndpoint(ENDPOINT);
    const pending = api.get<typeof rows>();

    // The first user signs out and a second signs in before the answer lands.
    mockGetCacheScopeKey.mockReturnValue('9_user-2');
    request.settle(rows);

    const response = await pending;

    // The caller that asked still gets its answer...
    expect(response.data).toEqual(rows);
    // ...but nothing is written to the second user's namespace, nor to the first user's.
    expect(mockStorageSet).not.toHaveBeenCalled();
    expect(mockStorageDelete).not.toHaveBeenCalledWith(USER_TWO_KEY);
  });

  it('does not evict the new identity entry when an empty response lands after a scope change', async () => {
    const request = pendingResponse<unknown[]>();

    const api = createCachedApiEndpoint(ENDPOINT);
    const pending = api.get<unknown[]>();

    mockGetCacheScopeKey.mockReturnValue('9_user-2');
    request.settle([]);

    await pending;

    expect(mockStorageDelete).not.toHaveBeenCalledWith(USER_TWO_KEY);
    expect(mockStorageSet).not.toHaveBeenCalled();
  });

  it('does not store a response under the new server when the base URL changes while it is pending', async () => {
    const rows = [{ UnitId: '1' }];
    const request = pendingResponse<typeof rows>();

    const api = createCachedApiEndpoint(ENDPOINT);
    const pending = api.get<typeof rows>();

    mockGetBaseApiUrl.mockReturnValue('https://other.test');
    request.settle(rows);

    await pending;

    expect(mockStorageSet).not.toHaveBeenCalled();
  });

  it('stores the response under the requesting identity when the scope holds still', async () => {
    const rows = [{ UnitId: '1' }];
    const request = pendingResponse<typeof rows>();

    const api = createCachedApiEndpoint(ENDPOINT, { enabled: true, ttl: 1000 });
    const pending = api.get<typeof rows>();

    request.settle(rows);
    await pending;

    expect(mockStorageSet).toHaveBeenCalledTimes(1);
    expect(mockStorageSet.mock.calls[0][0]).toBe(USER_ONE_KEY);
    expect(JSON.parse(mockStorageSet.mock.calls[0][1] as string)).toMatchObject({ data: rows, expiresIn: 1000 });
  });
});
