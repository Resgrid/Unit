import { create } from 'zustand';

import { cacheManager } from '@/lib/cache/cache-manager';
import { clearMapboxToken } from '@/lib/mapbox-token';
import { getBaseApiUrl, setBaseApiUrl } from '@/lib/storage/app';
import { invalidateConfigRequests } from '@/stores/app/core-store';

interface ServerUrlState {
  url: string;
  setUrl: (url: string) => Promise<void>;
  getUrl: () => Promise<string>;
}

export const useServerUrlStore = create<ServerUrlState>((set) => ({
  url: '',
  setUrl: async (url: string) => {
    const previousUrl = getBaseApiUrl();
    await setBaseApiUrl(url);
    set({ url });

    // Environment switch — drop all cached API data so content from the
    // previous server is never served against the new one. (Cache keys are
    // also scoped by base URL as a second layer of defense.)
    if (previousUrl !== url) {
      cacheManager.clear();
      // A config request still in flight is for the previous server; its answer must not be applied.
      invalidateConfigRequests();
      // The Mapbox token came from the previous server; the built-in one applies until the new server's config loads.
      clearMapboxToken();
    }
  },
  getUrl: async () => {
    const url = await getBaseApiUrl();
    set({ url });
    return url;
  },
}));
