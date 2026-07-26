import { cacheManager } from '@/lib/cache/cache-manager';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    delete: jest.fn(),
    getAllKeys: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.test'),
}));

const mockedDelete = storage.delete as jest.Mock;
const mockedGetAllKeys = storage.getAllKeys as jest.Mock;
const mockedGetString = storage.getString as jest.Mock;

const CACHE_KEY = 'api_cache_https://api.test_/test';

describe('CacheManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAllKeys.mockReturnValue([]);
  });

  it('returns data from a valid unexpired cache entry', () => {
    const data = { id: 'cached-result' };
    mockedGetString.mockReturnValue(
      JSON.stringify({
        data,
        timestamp: Date.now(),
        expiresIn: 60_000,
      })
    );

    expect(cacheManager.get('/test')).toEqual(data);
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty object', {}],
    ['a null value', null],
    ['a missing data field', { timestamp: Date.now(), expiresIn: 60_000 }],
    ['a nonnumeric timestamp', { data: 'value', timestamp: 'now', expiresIn: 60_000 }],
    ['a nonnumeric expiry', { data: 'value', timestamp: Date.now(), expiresIn: 'later' }],
  ])('evicts valid JSON with an invalid cache shape: %s', (_description, malformedEntry) => {
    mockedGetString.mockReturnValue(JSON.stringify(malformedEntry));

    expect(cacheManager.get('/test')).toBeNull();
    expect(mockedDelete).toHaveBeenCalledWith(CACHE_KEY);
  });

  it('evicts malformed cache shapes while pruning', () => {
    mockedGetAllKeys.mockReturnValue([CACHE_KEY]);
    mockedGetString.mockReturnValue('{}');

    cacheManager.prune();

    expect(mockedDelete).toHaveBeenCalledWith(CACHE_KEY);
  });
});
