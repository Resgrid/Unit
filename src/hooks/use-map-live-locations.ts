import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

import { applyLiveLocations, diffLiveLocations, type LiveLocations } from '@/lib/live-locations';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

/** Coalescing window for the refetch requested by pushes for pins the map does not have. */
export const UNKNOWN_PIN_REFRESH_DELAY_MS = 4000;
/** An unknown pin may request a refetch at most this often — the viewer may simply not be allowed to see it. */
export const UNKNOWN_PIN_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Re-apply live positions over freshly fetched REST pins. Only positions received at or after the
 * moment the fetch STARTED are applied: the snapshot can be older than a push that arrived while it
 * was in flight, but anything received before it started is already reflected (or superseded) by it.
 */
export function applyLiveLocationsSince(pins: MapMakerInfoData[], fetchStartedAt: number): MapMakerInfoData[] {
  return applyLiveLocations(pins, useSignalRStore.getState().liveLocations, { minReceivedAt: fetchStartedAt }).pins;
}

/**
 * Moves a live map's unit/personnel pins with the geolocation hub's pushes.
 *
 * Only positions that changed since the last run are applied, so a REST refetch that just replaced
 * the pins is not overwritten with older live positions (see `applyLiveLocationsSince` for the
 * refetch side). A push for a pin the map does not have asks for one coalesced background refetch via
 * `requestRefresh`, and every re-join of the hub after the first asks for a catch-up refetch, since
 * positions sent while disconnected were missed.
 *
 * The store is read through a subscription rather than a selector: pushes arrive per entity per
 * location cycle, and the map screen should only re-render when a pin actually moves.
 */
export function useMapLiveLocations(pins: MapMakerInfoData[], setPins: Dispatch<SetStateAction<MapMakerInfoData[]>>, requestRefresh?: () => void): void {
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const requestRefreshRef = useRef(requestRefresh);
  requestRefreshRef.current = requestRefresh;

  // Positions already held when the map mounts predate its initial fetch, which covers them.
  const appliedRef = useRef<LiveLocations | null>(null);
  if (appliedRef.current === null) {
    appliedRef.current = useSignalRStore.getState().liveLocations;
  }
  const lastJoinCountRef = useRef<number | null>(null);
  if (lastJoinCountRef.current === null) {
    lastJoinCountRef.current = useSignalRStore.getState().geolocationJoinCount;
  }

  const unknownRequestedAtRef = useRef<Map<string, number>>(new Map());
  const unknownRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleUnknownPinRefresh = (unknownPinIds: string[]) => {
      const now = Date.now();
      const requestedAt = unknownRequestedAtRef.current;
      const eligible = unknownPinIds.filter((pinId) => {
        const last = requestedAt.get(pinId);
        return last === undefined || now - last >= UNKNOWN_PIN_REFRESH_COOLDOWN_MS;
      });
      if (eligible.length === 0) {
        return;
      }
      eligible.forEach((pinId) => requestedAt.set(pinId, now));

      // One refetch for everything that turns up inside the window.
      if (unknownRefreshTimerRef.current) {
        return;
      }
      logger.debug({
        message: 'Live location received for pins missing from the map, scheduling a refetch',
        context: { unknownPinCount: eligible.length },
      });
      unknownRefreshTimerRef.current = setTimeout(() => {
        unknownRefreshTimerRef.current = null;
        requestRefreshRef.current?.();
      }, UNKNOWN_PIN_REFRESH_DELAY_MS);
    };

    const applyChangedLocations = (liveLocations: LiveLocations) => {
      const changed = diffLiveLocations(appliedRef.current ?? {}, liveLocations);
      appliedRef.current = liveLocations;
      if (Object.keys(changed).length === 0) {
        return;
      }

      // Returns the same array when nothing moved, so React bails out without re-rendering.
      setPins((current) => applyLiveLocations(current, changed).pins);

      // Until the first fetch lands every push looks unknown; that fetch will bring the pins anyway.
      const currentPins = pinsRef.current;
      if (!requestRefreshRef.current || currentPins.length === 0) {
        return;
      }
      const { unknownPinIds } = applyLiveLocations(currentPins, changed);
      if (unknownPinIds.length > 0) {
        scheduleUnknownPinRefresh(unknownPinIds);
      }
    };

    const handleJoinCount = (geolocationJoinCount: number) => {
      const previous = lastJoinCountRef.current ?? 0;
      lastJoinCountRef.current = geolocationJoinCount;
      // The first join is covered by the map's own initial fetch; a later one follows a gap in which
      // positions were pushed to nobody.
      if (geolocationJoinCount > previous && previous > 0) {
        requestRefreshRef.current?.();
      }
    };

    // Catch anything that changed between the first render and this subscription.
    const current = useSignalRStore.getState();
    applyChangedLocations(current.liveLocations);
    handleJoinCount(current.geolocationJoinCount);

    const unsubscribe = useSignalRStore.subscribe((state) => {
      if (state.liveLocations !== appliedRef.current) {
        applyChangedLocations(state.liveLocations);
      }
      if (state.geolocationJoinCount !== lastJoinCountRef.current) {
        handleJoinCount(state.geolocationJoinCount);
      }
    });

    return () => {
      unsubscribe();
      if (unknownRefreshTimerRef.current) {
        clearTimeout(unknownRefreshTimerRef.current);
        unknownRefreshTimerRef.current = null;
      }
    };
  }, [setPins]);
}
