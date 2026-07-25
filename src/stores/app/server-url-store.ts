import { create } from 'zustand';

import { cacheManager } from '@/lib/cache/cache-manager';
import { getBaseApiUrl, setBaseApiUrl } from '@/lib/storage/app';

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
    }
  },
  getUrl: async () => {
    const url = await getBaseApiUrl();
    set({ url });
    return url;
  },
}));
