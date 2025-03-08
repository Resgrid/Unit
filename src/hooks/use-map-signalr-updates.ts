import { useEffect } from 'react';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

export const useMapSignalRUpdates = (onMarkersUpdate: (markers: MapMakerInfoData[]) => void) => {
  const lastUpdateTimestamp = useSignalRStore((state) => state.lastUpdateTimestamp);

  useEffect(() => {
    const fetchAndUpdateMarkers = async () => {
      try {
        const mapDataAndMarkers = await getMapDataAndMarkers();

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
      } catch (error) {
        logger.error({
          message: 'Failed to update map markers from SignalR update',
          context: { error },
        });
      }
    };

    if (lastUpdateTimestamp > 0) {
      fetchAndUpdateMarkers();
    }
  }, [lastUpdateTimestamp, onMarkersUpdate]);
};
