import { logger } from '@/lib/logging';
import { storage } from '@/lib/storage';
import { getBaseApiUrl } from '@/lib/storage/app';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

// Hard cap on cached entries — MMKV growth is otherwise unbounded because
// endpoints with varying params (ids, dates) create a key per combination.
const MAX_CACHE_ENTRIES = 200;

export class CacheManager {
  private static instance: CacheManager;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private getCacheKey(endpoint: string, params?: Record<string, unknown>): string {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    // Scope by server base URL so cached data from one environment is never
    // served against another after a server-URL switch.
    const scope = getBaseApiUrl();
    return `api_cache_${scope}_${endpoint}${queryString}`;
  }

  private isExpired(timestamp: number, expiresIn: number): boolean {
    return Date.now() - timestamp > expiresIn;
  }

  set<T>(endpoint: string, data: T, params?: Record<string, unknown>, ttl: number = this.defaultTTL): void {
    const key = this.getCacheKey(endpoint, params);
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresIn: ttl,
    };
    storage.set(key, JSON.stringify(cacheItem));
  }

  get<T>(endpoint: string, params?: Record<string, unknown>): T | null {
    const key = this.getCacheKey(endpoint, params);
    const cached = storage.getString(key);

    if (!cached) {
      return null;
    }

    let cacheItem: CacheItem<T>;
    try {
      cacheItem = JSON.parse(cached);
    } catch {
      // Corrupted/truncated entry — evict it or every call for this key throws
      // forever and the endpoint is permanently broken.
      storage.delete(key);
      return null;
    }

    if (this.isExpired(cacheItem.timestamp, cacheItem.expiresIn)) {
      storage.delete(key);
      return null;
    }

    return cacheItem.data;
  }

  remove(endpoint: string, params?: Record<string, unknown>): void {
    const key = this.getCacheKey(endpoint, params);
    storage.delete(key);
  }

  /**
   * Deletes all expired cache entries and enforces the max-entry cap (oldest
   * first). Call periodically, e.g. once during app init.
   */
  prune(): void {
    try {
      const now = Date.now();
      const entries: { key: string; timestamp: number }[] = [];

      storage.getAllKeys().forEach((key) => {
        if (!key.startsWith('api_cache_')) {
          return;
        }
        const raw = storage.getString(key);
        if (!raw) {
          return;
        }
        try {
          const item = JSON.parse(raw) as CacheItem<unknown>;
          if (now - item.timestamp > item.expiresIn) {
            storage.delete(key);
          } else {
            entries.push({ key, timestamp: item.timestamp });
          }
        } catch {
          storage.delete(key);
        }
      });

      if (entries.length > MAX_CACHE_ENTRIES) {
        entries.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = entries.length - MAX_CACHE_ENTRIES;
        for (let i = 0; i < toDelete; i++) {
          storage.delete(entries[i].key);
        }
      }
    } catch (error) {
      logger.warn({
        message: 'Cache prune failed',
        context: { error },
      });
    }
  }

  clear(): void {
    const allKeys = storage.getAllKeys();
    allKeys.forEach((key) => {
      if (key.startsWith('api_cache_')) {
        storage.delete(key);
      }
    });
  }
}

export const cacheManager = CacheManager.getInstance();
