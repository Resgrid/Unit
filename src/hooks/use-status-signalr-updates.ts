import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logging';
import { useCoreStore } from '@/stores/app/core-store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

// Coalesce bursts of unitStatusUpdated messages into a single status fetch.
const DEBOUNCE_DELAY = 2000;

interface UnitStatusSignalRMessage {
  UnitId?: string;
}

export const useStatusSignalRUpdates = () => {
  const lastProcessedTimestamp = useRef<number>(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const refreshActiveUnitStatus = useCoreStore((state) => state.refreshActiveUnitStatus);

  const lastUnitStatusTimestamp = useSignalRStore((state) => state.lastUnitStatusTimestamp);
  const lastUnitStatusMessage = useSignalRStore((state) => state.lastUnitStatusMessage);

  useEffect(() => {
    if (lastUnitStatusTimestamp <= 0 || lastUnitStatusTimestamp === lastProcessedTimestamp.current || !activeUnitId) {
      return;
    }

    // Message arrives as a raw object — no JSON round-trip needed.
    const message = lastUnitStatusMessage as UnitStatusSignalRMessage | null;
    if (!message || typeof message !== 'object' || message.UnitId !== activeUnitId) {
      lastProcessedTimestamp.current = lastUnitStatusTimestamp;
      return;
    }

    // Debounce so a burst of status events yields ONE lightweight status fetch
    // (previously each message refetched the entire fleet via fetchUnits()).
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      lastProcessedTimestamp.current = lastUnitStatusTimestamp;

      logger.info({
        message: 'Refreshing active unit status from SignalR update',
        context: { unitId: activeUnitId, timestamp: lastUnitStatusTimestamp },
      });

      refreshActiveUnitStatus(activeUnitId).catch((error) => {
        logger.error({
          message: 'Failed to process unit status update',
          context: { error },
        });
      });
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [lastUnitStatusTimestamp, lastUnitStatusMessage, activeUnitId, refreshActiveUnitStatus]);
};
