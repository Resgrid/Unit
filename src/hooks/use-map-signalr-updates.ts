import { useCallback, useEffect, useRef } from 'react';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

// Debounce delay in milliseconds to prevent rapid consecutive API calls
const DEBOUNCE_DELAY = 1000;

export const useMapSignalRUpdates = (onMarkersUpdate: (markers: MapMakerInfoData[]) => void) => {
  const lastProcessedTimestamp = useRef<number>(0);
  const isUpdating = useRef<boolean>(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const lastUpdateTimestamp = useSignalRStore((state) => state.lastUpdateTimestamp);

  const fetchAndUpdateMarkers = useCallback(async () => {
    // Prevent concurrent API calls
    if (isUpdating.current) {
      logger.debug({
        message: 'Map markers update already in progress, skipping',
        context: { timestamp: lastUpdateTimestamp },
      });
      return;
    }

    // Cancel any previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create new abort controller for this request
    abortController.current = new AbortController();
    isUpdating.current = true;

    try {
      logger.debug({
        message: 'Fetching map markers from SignalR update',
        context: { timestamp: lastUpdateTimestamp },
      });

      const mapDataAndMarkers = await getMapDataAndMarkers();

      // Check if request was aborted
      if (abortController.current?.signal.aborted) {
        logger.debug({
          message: 'Map markers request was aborted',
          context: { timestamp: lastUpdateTimestamp },
        });
        return;
      }

      if (mapDataAndMarkers && mapDataAndMarkers.Data) {
        logger.info({
          message: 'Updating map markers from SignalR update',
          context: {
            markerCount: mapDataAndMarkers.Data.MapMakerInfos.length,
            timestamp: lastUpdateTimestamp,
          },
        });

        onMarkersUpdate(mapDataAndMarkers.Data.MapMakerInfos);
      }

      // Update the last processed timestamp after successful API call
      lastProcessedTimestamp.current = lastUpdateTimestamp;
    } catch (error) {
      // Don't log aborted requests as errors
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug({
          message: 'Map markers request was aborted',
          context: { timestamp: lastUpdateTimestamp },
        });
        return;
      }

      logger.error({
        message: 'Failed to update map markers from SignalR update',
        context: { error, timestamp: lastUpdateTimestamp },
      });
      // Don't update lastProcessedTimestamp on error so it can be retried
    } finally {
      isUpdating.current = false;
      abortController.current = null;
    }
  }, [lastUpdateTimestamp, onMarkersUpdate]);

  useEffect(() => {
    // Clear any existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Only process if we have a valid timestamp and it's different from the last processed one
    if (lastUpdateTimestamp > 0 && lastUpdateTimestamp !== lastProcessedTimestamp.current) {
      logger.debug({
        message: 'Debouncing map markers update',
        context: {
          lastUpdateTimestamp,
          lastProcessed: lastProcessedTimestamp.current,
          delay: DEBOUNCE_DELAY,
        },
      });

      // Debounce the API call to prevent rapid consecutive requests
      debounceTimer.current = setTimeout(() => {
        fetchAndUpdateMarkers();
      }, DEBOUNCE_DELAY);
    }

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [lastUpdateTimestamp, fetchAndUpdateMarkers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Abort any ongoing request
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);
};
