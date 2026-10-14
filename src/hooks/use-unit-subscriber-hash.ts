import { useEffect, useState } from 'react';

import { getUnitSubscriberHash } from '@/api/novu/inbox';
import { logger } from '@/lib/logging';

/**
 * The Novu subscriberHash for the active unit's inbox. Novu refuses an inbox session without it once HMAC is
 * enforced on the environment, and only the server can make it.
 *
 * `settled` turns true for a unit once its fetch has finished either way, so the inbox is opened once with the
 * hash instead of first without it and again with it. A failed fetch settles without a hash: the inbox still
 * opens while Novu does not enforce HMAC, and an older server has no such endpoint.
 */
export const useUnitSubscriberHash = (unitId: string | null | undefined) => {
  const [fetched, setFetched] = useState<{ unitId: string; hash?: string } | null>(null);

  useEffect(() => {
    if (!unitId) {
      return;
    }

    let cancelled = false;

    getUnitSubscriberHash(unitId)
      .then((result) => {
        if (!cancelled) {
          setFetched({ unitId, hash: result?.Data?.SubscriberHash ?? undefined });
        }
      })
      .catch((error) => {
        logger.warn({ message: 'Could not fetch the unit inbox subscriber hash', context: { unitId, error } });
        if (!cancelled) {
          setFetched({ unitId });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const settled = !!unitId && fetched?.unitId === unitId;

  return { settled, subscriberHash: settled ? fetched?.hash : undefined };
};
