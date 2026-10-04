jest.mock('@/lib/cache/cache-manager', () => ({
  cacheManager: { clear: jest.fn() },
}));

jest.mock('@/lib/mapbox-token', () => ({
  clearMapboxToken: jest.fn(),
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(),
  setBaseApiUrl: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/stores/app/core-store', () => ({
  invalidateConfigRequests: jest.fn(),
}));

import { cacheManager } from '@/lib/cache/cache-manager';
import { clearMapboxToken } from '@/lib/mapbox-token';
import { getBaseApiUrl, setBaseApiUrl } from '@/lib/storage/app';
import { invalidateConfigRequests } from '@/stores/app/core-store';

import { useServerUrlStore } from '../server-url-store';

const mockGetBaseApiUrl = getBaseApiUrl as jest.MockedFunction<typeof getBaseApiUrl>;

describe('server-url-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useServerUrlStore.setState({ url: '' });
  });

  it('drops data from the previous server when the URL changes', async () => {
    mockGetBaseApiUrl.mockReturnValue('https://old.example.com/api/v4');

    await useServerUrlStore.getState().setUrl('https://new.example.com/api/v4');

    expect(setBaseApiUrl).toHaveBeenCalledWith('https://new.example.com/api/v4');
    expect(useServerUrlStore.getState().url).toBe('https://new.example.com/api/v4');
    expect(cacheManager.clear).toHaveBeenCalled();
    // A config response still in flight for the old server must not bring back its config or Mapbox token.
    expect(invalidateConfigRequests).toHaveBeenCalled();
    expect(clearMapboxToken).toHaveBeenCalled();
  });

  it('keeps everything when the same URL is saved again', async () => {
    mockGetBaseApiUrl.mockReturnValue('https://same.example.com/api/v4');

    await useServerUrlStore.getState().setUrl('https://same.example.com/api/v4');

    expect(cacheManager.clear).not.toHaveBeenCalled();
    expect(invalidateConfigRequests).not.toHaveBeenCalled();
    expect(clearMapboxToken).not.toHaveBeenCalled();
  });
});
