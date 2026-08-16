import { type AxiosResponse } from 'axios';

import { cacheManager } from '@/lib/cache/cache-manager';

import { createApiEndpoint } from './client';

interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  enabled?: boolean; // Whether to use cache for this endpoint
}

interface GetOptions {
  /** Skip the cached copy and refresh from the server. Use for pull-to-refresh and retries. */
  forceRefresh?: boolean;
}

/**
 * True when a v4 payload carries no rows.
 *
 * The v4 controllers answer an empty list with HTTP 200 and `{ Data: [], Status: 'not_found' }`, so
 * a permissions blip or a transient server-side failure looks identical to a real answer at this
 * layer. Caching that meant a single bad response hid every unit and every dispatch recipient for
 * the whole TTL, and the UI reported it as "there are none" rather than "we could not load them".
 * Empty answers are cheap to re-fetch, so never keep one.
 */
const isEmptyPayload = (payload: unknown): boolean => {
  if (payload === null || payload === undefined) {
    return true;
  }

  if (typeof payload !== 'object') {
    return false;
  }

  if (Array.isArray(payload)) {
    return payload.length === 0;
  }

  const body = payload as { Data?: unknown; Status?: unknown };

  if (typeof body.Status === 'string' && body.Status.toLowerCase() === 'not_found') {
    return true;
  }

  if (!('Data' in body)) {
    return false;
  }

  if (body.Data === null || body.Data === undefined) {
    return true;
  }

  return Array.isArray(body.Data) && body.Data.length === 0;
};

export const createCachedApiEndpoint = (endpoint: string, cacheConfig: CacheConfig = { enabled: true }) => {
  const api = createApiEndpoint(endpoint);
  const defaultTTL = 5 * 60 * 1000; // 5 minutes

  return {
    get: async <T>(params?: Record<string, unknown>, options?: GetOptions): Promise<AxiosResponse<T>> => {
      if (!cacheConfig.enabled) {
        return api.get<T>(params);
      }

      if (!options?.forceRefresh) {
        const cached = cacheManager.get<T>(endpoint, params);
        if (cached) {
          return Promise.resolve({
            data: cached,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config: {},
          } as AxiosResponse<T>);
        }
      }

      // Cache keys are namespaced by server URL and signed-in identity, and both can change while
      // this request is in flight — a sign-out, a department switch, a server-URL change. Capture
      // the namespace up front: the write below recomputes it, so a response fetched as one
      // identity would otherwise be filed under, or evict an entry belonging to, the next one.
      const scopeAtRequest = cacheManager.getScopeIdentity();

      const response = await api.get<T>(params);

      if (cacheManager.getScopeIdentity() !== scopeAtRequest) {
        // Hand the answer back to the caller that asked for it, but leave the new identity's cache
        // untouched — this data is not theirs.
        return response;
      }

      if (isEmptyPayload(response.data)) {
        // A previously cached non-empty answer must not outlive an empty one, or the next read
        // silently reverts to stale rows.
        cacheManager.remove(endpoint, params);
      } else {
        cacheManager.set(endpoint, response.data, params, cacheConfig.ttl || defaultTTL);
      }

      return response;
    },
    post: api.post,
    put: api.put,
    delete: api.delete,
  };
};
