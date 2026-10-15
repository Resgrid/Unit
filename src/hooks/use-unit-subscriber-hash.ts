import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';

import { getUnitSubscriberHash } from '@/api/novu/inbox';
import { logger } from '@/lib/logging';

/** First retry delay for a lookup that failed without an answer; each later one doubles, up to the max. */
export const SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS = 2000;
export const SUBSCRIBER_HASH_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;
/** Failed lookups before the inbox opens without a hash anyway; the retries carry on behind it. */
export const SUBSCRIBER_HASH_ATTEMPTS_BEFORE_SETTLING = 3;

/**
 * The server answered, and asking again cannot change that: an older server has no such endpoint (404), or it
 * refuses this unit. A failure with no answer (offline, a timeout, a 5xx, rate limiting) is worth retrying.
 */
const isDefinitiveFailure = (error: unknown): boolean => {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
};

/**
 * The Novu subscriberHash for the active unit's inbox. Novu refuses an inbox session without it once HMAC is
 * enforced on the environment, and only the server can make it.
 *
 * `settled` turns true for a unit once its fetch has an outcome, so the inbox is opened once with the hash instead
 * of first without it and again with it. A definitive failure (an older server has no such endpoint) settles without
 * a hash straight away: the inbox still opens while Novu does not enforce HMAC. A failure with no answer is retried
 * with backoff and only settles without a hash after a few attempts, so the inbox is not held back forever. The
 * retries carry on after that, and a hash that arrives later replaces the missing one in the open inbox.
 */
export const useUnitSubscriberHash = (unitId: string | null | undefined) => {
  const [fetched, setFetched] = useState<{ unitId: string; hash?: string } | null>(null);

  useEffect(() => {
    if (!unitId) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const attempt = (failures: number) => {
      getUnitSubscriberHash(unitId)
        .then((result) => {
          if (!cancelled) {
            setFetched({ unitId, hash: result?.Data?.SubscriberHash ?? undefined });
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          const failed = failures + 1;
          const definitive = isDefinitiveFailure(error);
          logger.warn({ message: 'Could not fetch the unit inbox subscriber hash', context: { unitId, attempt: failed, willRetry: !definitive, error } });

          if (definitive || failed === SUBSCRIBER_HASH_ATTEMPTS_BEFORE_SETTLING) {
            setFetched({ unitId });
          }

          if (!definitive) {
            retryTimer = setTimeout(() => attempt(failed), Math.min(SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS * 2 ** failures, SUBSCRIBER_HASH_RETRY_MAX_DELAY_MS));
          }
        });
    };

    attempt(0);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [unitId]);

  const settled = !!unitId && fetched?.unitId === unitId;

  return { settled, subscriberHash: settled ? fetched?.hash : undefined };
};
