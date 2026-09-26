import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

/**
 * Realtime unit/personnel positions pushed by the geolocation hub, and the pure helpers that move
 * live-map pins with them.
 *
 * The hub broadcasts every position in the department to the whole department group. Unlike the REST
 * map endpoint it applies neither the per-viewer visibility matrix nor the location TTLs, so a push may
 * only MOVE a pin the REST map data already contains — it must never create one.
 */

/** `MapMakerInfoData.Type` for a unit pin (`u{UnitId}`). */
export const UNIT_PIN_TYPE = 1;
/** `MapMakerInfoData.Type` for a personnel pin (`p{UserId}`). */
export const PERSONNEL_PIN_TYPE = 3;

export type LiveLocationKind = 'unit' | 'personnel';

export interface LiveLocation {
  /** The map pin this position belongs to: `u{UnitId}` or `p{userId}`, always lower-case. */
  pinId: string;
  latitude: number;
  longitude: number;
  /** UTC time of the GPS fix in epoch ms, or null when the server did not send a usable one. */
  timestamp: number | null;
  /** Epoch ms at which this client received the push. */
  receivedAt: number;
}

/** Latest live position per pin id. */
export type LiveLocations = Record<string, LiveLocation>;

export interface ApplyLiveLocationsOptions {
  /** Only apply positions received at or after this epoch ms — e.g. when a REST refetch started. */
  minReceivedAt?: number;
}

export interface ApplyLiveLocationsResult {
  /** The same array when nothing moved; otherwise a copy with new objects for the moved pins only. */
  pins: MapMakerInfoData[];
  /** Pin ids that had a live position but no unit/personnel pin in `pins`. */
  unknownPinIds: string[];
}

// An ISO-8601 time that already says which zone it is in.
const HAS_ZONE_DESIGNATOR = /(?:z|[+-]\d{2}:?\d{2})$/i;

function toPayloadRecord(payload: unknown): Record<string, unknown> | null {
  let value = payload;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The server's JSON protocol sends camelCase; older producers and hand-rolled payloads use PascalCase. */
function readField(record: Record<string, unknown>, camelName: string): unknown {
  const camelValue = record[camelName];
  if (camelValue !== undefined && camelValue !== null) {
    return camelValue;
  }
  return record[camelName.charAt(0).toUpperCase() + camelName.slice(1)];
}

function toCoordinate(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return Number.NaN;
}

function toIdentifier(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/**
 * Epoch ms of the fix, or null for "unknown". The field is new — older servers omit it — and a value
 * that cannot be read must not block the update, so anything unusable degrades to unknown.
 */
function toFixTimestamp(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // The contract is UTC. A .NET DateTime with an unspecified kind serializes without a zone, which
  // JavaScript would otherwise read as device-local time.
  const parsed = Date.parse(HAS_ZONE_DESIGNATOR.test(trimmed) ? trimmed : `${trimmed}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse an `onUnitLocationUpdated` / `onPersonnelLocationUpdated` push into a live location, or null
 * when the payload is unusable (no id, non-finite or out-of-range coordinates, or 0,0).
 */
export function parseLiveLocationPayload(kind: LiveLocationKind, payload: unknown, receivedAt: number = Date.now()): LiveLocation | null {
  const record = toPayloadRecord(payload);
  if (!record) {
    return null;
  }

  const entityId = toIdentifier(readField(record, kind === 'unit' ? 'unitId' : 'userId'));
  if (!entityId) {
    return null;
  }

  const latitude = toCoordinate(readField(record, 'latitude'));
  const longitude = toCoordinate(readField(record, 'longitude'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  // 0,0 is what an unset position serializes as, not a real fix.
  if (latitude === 0 && longitude === 0) {
    return null;
  }

  return {
    pinId: `${kind === 'unit' ? 'u' : 'p'}${entityId}`,
    latitude,
    longitude,
    timestamp: toFixTimestamp(readField(record, 'timestamp')),
    receivedAt,
  };
}

/**
 * Record an update for its pin. Trackers replay buffered fixes and queue consumers can reorder, so an
 * update whose fix is OLDER than the one already held for that pin is dropped (the same object is
 * returned). An update with an unknown timestamp always applies.
 */
export function mergeLiveLocation(current: LiveLocations, update: LiveLocation): LiveLocations {
  const existing = current[update.pinId];
  if (existing && existing.timestamp !== null && update.timestamp !== null && update.timestamp < existing.timestamp) {
    return current;
  }
  return { ...current, [update.pinId]: update };
}

/** The entries of `next` that are new or replaced relative to `previous` (by reference). */
export function diffLiveLocations(previous: LiveLocations, next: LiveLocations): LiveLocations {
  if (previous === next) {
    return {};
  }
  const changed: LiveLocations = {};
  Object.keys(next).forEach((pinId) => {
    const location = next[pinId];
    if (location && previous[pinId] !== location) {
      changed[pinId] = location;
    }
  });
  return changed;
}

/**
 * Move unit (Type 1) and personnel (Type 3) pins to their live positions.
 *
 * Pins are `React.memo`'d, so this never mutates: it returns the SAME array when nothing moved, and
 * otherwise a copy in which only the moved pins are new objects. Ids match case-insensitively (the
 * REST user id and the pushed one can differ in casing). A live position without a matching pin is
 * reported in `unknownPinIds` and never turned into a pin.
 */
export function applyLiveLocations(pins: MapMakerInfoData[], liveLocations: LiveLocations, options: ApplyLiveLocationsOptions = {}): ApplyLiveLocationsResult {
  const { minReceivedAt } = options;

  const pending = new Map<string, LiveLocation>();
  Object.keys(liveLocations).forEach((key) => {
    const location = liveLocations[key];
    if (!location || (minReceivedAt !== undefined && location.receivedAt < minReceivedAt)) {
      return;
    }
    pending.set(location.pinId.toLowerCase(), location);
  });

  if (pending.size === 0) {
    return { pins, unknownPinIds: [] };
  }

  let next: MapMakerInfoData[] | null = null;
  const matched = new Set<string>();

  for (let index = 0; index < pins.length; index += 1) {
    const pin = pins[index];
    if (!pin || (pin.Type !== UNIT_PIN_TYPE && pin.Type !== PERSONNEL_PIN_TYPE) || typeof pin.Id !== 'string') {
      continue;
    }
    const pinId = pin.Id.toLowerCase();
    const location = pending.get(pinId);
    if (!location) {
      continue;
    }
    matched.add(pinId);
    if (pin.Latitude === location.latitude && pin.Longitude === location.longitude) {
      continue;
    }
    if (!next) {
      next = pins.slice();
    }
    next[index] = { ...pin, Latitude: location.latitude, Longitude: location.longitude };
  }

  const unknownPinIds: string[] = [];
  pending.forEach((_location, pinId) => {
    if (!matched.has(pinId)) {
      unknownPinIds.push(pinId);
    }
  });

  return { pins: next ?? pins, unknownPinIds };
}
