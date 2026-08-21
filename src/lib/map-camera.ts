/**
 * Pure helpers for the map's follow-the-unit camera and location indicator.
 *
 * The camera zoom scales with how fast the unit is moving so the view works for
 * both crews on foot (walking pace, tight zoom) and vehicles (highway speed,
 * wide zoom) — the same way turn-by-turn navigation apps frame the road ahead.
 */

/** Speed (m/s) → zoom level anchor points, interpolated linearly between them. */
const SPEED_ZOOM_STOPS: readonly (readonly [number, number])[] = [
  [0, 17], // stationary — tight view for crews on foot
  [1.5, 16.5], // walking pace (~5 km/h)
  [4, 16], // jogging / vehicle crawling
  [9, 15], // ~32 km/h urban response
  [18, 14], // ~65 km/h
  [28, 13.25], // ~100 km/h highway
  [40, 12.5], // upper bound
];

/**
 * Zoom level for a given ground speed in meters/second. Piecewise-linear over
 * SPEED_ZOOM_STOPS and clamped to the outer stops, so walking speeds resolve to
 * street-level zoom and highway speeds pull the camera out for lookahead.
 */
export function zoomForSpeed(speedMps: number): number {
  const speed = normalizeSpeed(speedMps);

  const [firstSpeed, firstZoom] = SPEED_ZOOM_STOPS[0];
  if (speed <= firstSpeed) return firstZoom;

  for (let i = 1; i < SPEED_ZOOM_STOPS.length; i++) {
    const [stopSpeed, stopZoom] = SPEED_ZOOM_STOPS[i];
    if (speed <= stopSpeed) {
      const [prevSpeed, prevZoom] = SPEED_ZOOM_STOPS[i - 1];
      const ratio = (speed - prevSpeed) / (stopSpeed - prevSpeed);
      return prevZoom + (stopZoom - prevZoom) * ratio;
    }
  }

  return SPEED_ZOOM_STOPS[SPEED_ZOOM_STOPS.length - 1][1];
}

/**
 * GPS heading is degrees clockwise from north, but platforms report "no fix"
 * as -1 (iOS) or null. Returns a value in [0, 360) or null when there is no
 * usable heading.
 */
export function normalizeHeading(heading: number | null | undefined): number | null {
  if (heading == null || !Number.isFinite(heading) || heading < 0) {
    return null;
  }
  return heading % 360;
}

/** GPS speed is m/s, with "no fix" reported as -1 (iOS) or null. Clamps to >= 0. */
export function normalizeSpeed(speed: number | null | undefined): number {
  if (speed == null || !Number.isFinite(speed) || speed < 0) {
    return 0;
  }
  return speed;
}

/**
 * Exponential moving average over successive speed fixes. GPS speed is noisy —
 * smoothing keeps the camera from pumping zoom in and out on every fix.
 */
export function smoothSpeed(previous: number | null, next: number, alpha: number = 0.4): number {
  const target = normalizeSpeed(next);
  if (previous == null) return target;
  return previous + (target - previous) * alpha;
}

/**
 * Apply hysteresis to a proposed zoom change: keep the current zoom unless the
 * new target differs by at least `threshold` levels. Prevents oscillation when
 * a speed hovers around a stop boundary.
 */
export function applyZoomHysteresis(currentZoom: number | null, targetZoom: number, threshold: number = 0.25): number {
  if (currentZoom == null) return targetZoom;
  return Math.abs(targetZoom - currentZoom) >= threshold ? targetZoom : currentZoom;
}

/** Camera pitch while the unit is moving (navigation-style tilt behind the unit). */
export const FOLLOW_PITCH_MOVING = 45;
/** Smoothed speed (m/s) above which the camera tilts up behind the unit. */
export const PITCH_TILT_UP_SPEED_MPS = 1.5;
/** Smoothed speed (m/s) below which the camera returns to a top-down view. */
export const PITCH_TILT_DOWN_SPEED_MPS = 0.7;

/**
 * Pitch for a given smoothed ground speed, with hysteresis so the camera
 * doesn't flip between tilted and top-down when speed hovers around the
 * moving/stationary boundary (mirrors the zoom hysteresis above): tilt up
 * above PITCH_TILT_UP_SPEED_MPS, tilt down below PITCH_TILT_DOWN_SPEED_MPS,
 * and hold the current pitch in between.
 */
export function applyPitchHysteresis(currentPitch: number | null, speedMps: number): number {
  const speed = normalizeSpeed(speedMps);
  if (speed >= PITCH_TILT_UP_SPEED_MPS) return FOLLOW_PITCH_MOVING;
  if (speed <= PITCH_TILT_DOWN_SPEED_MPS) return 0;
  return currentPitch ?? 0;
}

/** Wrap a longitude into [-180, 180). */
export function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/**
 * GeoJSON circle polygon around a coordinate, radius in meters. Corrects
 * longitude spacing by latitude so the circle stays round away from the
 * equator (one degree of longitude shrinks with cos(latitude)).
 */
export function createCirclePolygon(longitude: number, latitude: number, radiusMeters: number, points: number = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  // Normalize an out-of-range center into [-180, 180). Vertex offsets are then
  // applied WITHOUT re-wrapping: a ring that pokes just past ±180 must stay
  // contiguous for Mapbox to render it across the antimeridian (re-wrapping
  // individual vertices would flip them to the far side of the world).
  const centerLon = wrapLongitude(longitude);
  const latRadiusDeg = radiusMeters / 110574;
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  // Near the poles cos(lat) approaches zero; floor it so the division stays finite.
  const lonRadiusDeg = radiusMeters / (111320 * Math.max(Math.abs(cosLat), 0.01));

  const coords: number[][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    // Clamp latitude so a large radius near a pole stays a valid coordinate.
    const lat = Math.min(90, Math.max(-90, latitude + latRadiusDeg * Math.sin(angle)));
    coords.push([centerLon + lonRadiusDeg * Math.cos(angle), lat]);
  }
  // Close the ring exactly — sin/cos at 2π carry float error, and GeoJSON
  // requires the first and last positions to be identical.
  coords.push([...coords[0]]);

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}
