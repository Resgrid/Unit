/**
 * Decides which location fixes are worth transmitting to the unit-location endpoint.
 *
 * The OS does not pace fixes the way the request asks: iOS ignores `timeInterval` entirely and
 * reports on every `distanceInterval` of travel, so a unit at highway speed produces several fixes a
 * second. The OS-managed task and the foreground watcher can also both be running at once. Posting
 * every one of those keeps the cellular radio awake for nothing — dispatch only needs the latest
 * position at a steady cadence.
 *
 * Pure state machine; the caller owns the clock and the actual send.
 */

export interface LocationTransmissionGateOptions {
  /** Never transmit more often than this. */
  minIntervalMs: number;
  /** Movement below this since the last transmission is GPS jitter, not travel. */
  minDistanceMeters: number;
  /** A unit that has not moved still re-confirms its position this often, when a fix arrives. */
  stationaryIntervalMs: number;
}

export type TransmissionDecision =
  /** Transmit now. */
  | { action: 'send' }
  /** The unit moved, but the last transmission was too recent: transmit after `retryInMs`. */
  | { action: 'defer'; retryInMs: number }
  /** Nothing new to say: the unit is where it was when last transmitted. */
  | { action: 'skip' };

export interface TransmissionCoordinates {
  latitude: number;
  longitude: number;
}

interface TransmittedFix extends TransmissionCoordinates {
  unitId: string;
  transmittedAt: number;
  /** False once the server refused it: the position is not on the server, only the pacing stands. */
  accepted: boolean;
}

/** Opaque handle for one recorded transmission. */
export type TransmissionRecord = Readonly<TransmittedFix>;

const EARTH_RADIUS_METERS = 6371008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance in meters (haversine). */
export const distanceInMeters = (from: TransmissionCoordinates, to: TransmissionCoordinates): number => {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export class LocationTransmissionGate {
  private last: TransmittedFix | null = null;

  constructor(private readonly options: LocationTransmissionGateOptions) {}

  evaluate(unitId: string, coordinates: TransmissionCoordinates, now: number): TransmissionDecision {
    const last = this.last;

    // A different unit has never been transmitted; a clock that went backwards makes the elapsed
    // time meaningless. Either way, start over.
    if (!last || last.unitId !== unitId || now < last.transmittedAt) {
      return { action: 'send' };
    }

    const elapsed = now - last.transmittedAt;

    // A refused position never reached the server, so any fix is news — but still no faster than
    // the interval, or a failing server would be retried on every fix.
    if (last.accepted && distanceInMeters(last, coordinates) < this.options.minDistanceMeters) {
      return elapsed >= this.options.stationaryIntervalMs ? { action: 'send' } : { action: 'skip' };
    }

    return elapsed >= this.options.minIntervalMs ? { action: 'send' } : { action: 'defer', retryInMs: this.options.minIntervalMs - elapsed };
  }

  /** Record a transmission attempt. Recorded before the request resolves, so concurrent fixes see it. */
  record(unitId: string, coordinates: TransmissionCoordinates, now: number): TransmissionRecord {
    const record: TransmittedFix = { unitId, latitude: coordinates.latitude, longitude: coordinates.longitude, transmittedAt: now, accepted: true };
    this.last = record;
    return record;
  }

  /**
   * The server refused `record`. Ignored when a newer transmission has been recorded since: that
   * one's outcome is what decides the next fix.
   */
  markRejected(record: TransmissionRecord): void {
    if (this.last === record) {
      this.last = { ...record, accepted: false };
    }
  }

  /** When the last transmission was recorded (epoch ms), or null if none has been. */
  getLastTransmittedAt(): number | null {
    return this.last?.transmittedAt ?? null;
  }

  reset(): void {
    this.last = null;
  }
}
