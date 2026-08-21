import { applyPitchHysteresis, applyZoomHysteresis, createCirclePolygon, FOLLOW_PITCH_MOVING, normalizeHeading, normalizeSpeed, smoothSpeed, wrapLongitude, zoomForSpeed } from '../map-camera';

describe('zoomForSpeed', () => {
  it('returns the tightest zoom when stationary', () => {
    expect(zoomForSpeed(0)).toBe(17);
  });

  it('treats invalid speeds as stationary', () => {
    expect(zoomForSpeed(-1)).toBe(17);
    expect(zoomForSpeed(NaN)).toBe(17);
  });

  it('stays near street level at walking pace', () => {
    // ~1.4 m/s = typical walking speed
    const zoom = zoomForSpeed(1.4);
    expect(zoom).toBeGreaterThan(16);
    expect(zoom).toBeLessThanOrEqual(17);
  });

  it('zooms out for urban driving speeds', () => {
    // ~13.4 m/s = 30 mph
    const zoom = zoomForSpeed(13.4);
    expect(zoom).toBeGreaterThan(14);
    expect(zoom).toBeLessThan(15.5);
  });

  it('zooms out further at highway speed', () => {
    // ~29 m/s = 65 mph
    const zoom = zoomForSpeed(29);
    expect(zoom).toBeGreaterThan(12.5);
    expect(zoom).toBeLessThan(13.5);
  });

  it('clamps at the widest zoom for extreme speeds', () => {
    expect(zoomForSpeed(100)).toBe(12.5);
  });

  it('is monotonically non-increasing as speed rises', () => {
    let previous = Infinity;
    for (let speed = 0; speed <= 45; speed += 0.5) {
      const zoom = zoomForSpeed(speed);
      expect(zoom).toBeLessThanOrEqual(previous);
      previous = zoom;
    }
  });

  it('interpolates linearly between stops', () => {
    // Midpoint of the [4, 16] → [9, 15] segment
    expect(zoomForSpeed(6.5)).toBeCloseTo(15.5, 5);
  });
});

describe('normalizeHeading', () => {
  it('passes through valid headings', () => {
    expect(normalizeHeading(0)).toBe(0);
    expect(normalizeHeading(180)).toBe(180);
    expect(normalizeHeading(359.9)).toBeCloseTo(359.9);
  });

  it('wraps headings of 360 and above', () => {
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(450)).toBe(90);
  });

  it('returns null for missing or invalid headings', () => {
    expect(normalizeHeading(null)).toBeNull();
    expect(normalizeHeading(undefined)).toBeNull();
    // iOS reports "no heading fix" as -1
    expect(normalizeHeading(-1)).toBeNull();
    expect(normalizeHeading(NaN)).toBeNull();
  });
});

describe('normalizeSpeed', () => {
  it('passes through valid speeds', () => {
    expect(normalizeSpeed(5)).toBe(5);
  });

  it('clamps missing or invalid speeds to zero', () => {
    expect(normalizeSpeed(null)).toBe(0);
    expect(normalizeSpeed(undefined)).toBe(0);
    // iOS reports "no speed fix" as -1
    expect(normalizeSpeed(-1)).toBe(0);
    expect(normalizeSpeed(NaN)).toBe(0);
  });
});

describe('smoothSpeed', () => {
  it('adopts the first sample directly', () => {
    expect(smoothSpeed(null, 10)).toBe(10);
  });

  it('moves partway toward the new sample', () => {
    expect(smoothSpeed(0, 10, 0.4)).toBeCloseTo(4);
    expect(smoothSpeed(10, 0, 0.4)).toBeCloseTo(6);
  });

  it('converges to a steady speed over repeated samples', () => {
    let smoothed: number | null = null;
    for (let i = 0; i < 30; i++) {
      smoothed = smoothSpeed(smoothed, 20);
    }
    expect(smoothed).toBeCloseTo(20, 1);
  });

  it('normalizes invalid samples to zero', () => {
    expect(smoothSpeed(10, -1, 0.5)).toBe(5);
  });
});

describe('applyZoomHysteresis', () => {
  it('adopts the target when there is no current zoom', () => {
    expect(applyZoomHysteresis(null, 16)).toBe(16);
  });

  it('keeps the current zoom for changes below the threshold', () => {
    expect(applyZoomHysteresis(16, 16.1)).toBe(16);
    expect(applyZoomHysteresis(16, 15.9)).toBe(16);
  });

  it('adopts the target for changes at or above the threshold', () => {
    expect(applyZoomHysteresis(16, 16.5)).toBe(16.5);
    expect(applyZoomHysteresis(16, 15)).toBe(15);
  });
});

describe('applyPitchHysteresis', () => {
  it('tilts up once clearly moving', () => {
    expect(applyPitchHysteresis(0, 2)).toBe(FOLLOW_PITCH_MOVING);
  });

  it('returns to top-down once clearly stopped', () => {
    expect(applyPitchHysteresis(FOLLOW_PITCH_MOVING, 0.2)).toBe(0);
  });

  it('holds the current pitch inside the dead band', () => {
    // Between the tilt-down (0.7) and tilt-up (1.5) thresholds the pitch sticks,
    // so a speed hovering around 1 m/s can't flip the camera every fix.
    expect(applyPitchHysteresis(0, 1)).toBe(0);
    expect(applyPitchHysteresis(FOLLOW_PITCH_MOVING, 1)).toBe(FOLLOW_PITCH_MOVING);
  });

  it('does not oscillate when speed jitters around 1 m/s', () => {
    const speeds = [0.9, 1.1, 0.95, 1.2, 1.05, 0.85];
    let pitch = 0;
    for (const speed of speeds) {
      pitch = applyPitchHysteresis(pitch, speed);
      expect(pitch).toBe(0);
    }
  });

  it('defaults to top-down when there is no previous pitch', () => {
    expect(applyPitchHysteresis(null, 1)).toBe(0);
  });

  it('treats invalid speeds as stationary', () => {
    expect(applyPitchHysteresis(FOLLOW_PITCH_MOVING, -1)).toBe(0);
    expect(applyPitchHysteresis(FOLLOW_PITCH_MOVING, NaN)).toBe(0);
  });
});

describe('wrapLongitude', () => {
  it('passes through in-range longitudes', () => {
    expect(wrapLongitude(0)).toBe(0);
    expect(wrapLongitude(-122.4)).toBeCloseTo(-122.4);
  });

  it('wraps longitudes past the antimeridian', () => {
    expect(wrapLongitude(181)).toBeCloseTo(-179);
    expect(wrapLongitude(-181)).toBeCloseTo(179);
    expect(wrapLongitude(540)).toBeCloseTo(-180);
  });
});

describe('createCirclePolygon', () => {
  it('produces a closed polygon ring', () => {
    const circle = createCirclePolygon(-122.4, 47.6, 100);
    const ring = circle.geometry.coordinates[0];
    expect(ring.length).toBe(65);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('closes the ring exactly rather than relying on sin/cos at 2π', () => {
    const ring = createCirclePolygon(-122.4, 47.6, 100).geometry.coordinates[0];
    const first = ring[0];
    const last = ring[ring.length - 1];
    // Strict equality — GeoJSON requires an identical closing position, and
    // computing it from sin(2π)/cos(2π) leaves floating point residue.
    expect(last[0]).toBe(first[0]);
    expect(last[1]).toBe(first[1]);
  });

  it('normalizes a center longitude given outside [-180, 180)', () => {
    const wrapped = createCirclePolygon(181, 0, 100).geometry.coordinates[0];
    const direct = createCirclePolygon(-179, 0, 100).geometry.coordinates[0];
    expect(wrapped[0][0]).toBeCloseTo(direct[0][0], 9);
  });

  it('keeps a ring spanning the antimeridian contiguous', () => {
    // Centered just west of the antimeridian with a large radius, the ring's
    // eastern vertices run past +180. They must stay contiguous (not jump to
    // -180) or the polygon smears right across the map.
    const ring = createCirclePolygon(179.999, 0, 50000).geometry.coordinates[0];
    const lons = ring.map((c) => c[0]);
    expect(Math.max(...lons)).toBeGreaterThan(180);
    for (let i = 1; i < lons.length; i++) {
      expect(Math.abs(lons[i] - lons[i - 1])).toBeLessThan(180);
    }
  });

  it('clamps latitudes so a polar circle stays a valid coordinate', () => {
    const ring = createCirclePolygon(0, 89.999, 200000).geometry.coordinates[0];
    ring.forEach(([, lat]) => {
      expect(lat).toBeLessThanOrEqual(90);
      expect(lat).toBeGreaterThanOrEqual(-90);
    });
  });

  it('centers the ring on the given coordinate', () => {
    const circle = createCirclePolygon(-122.4, 47.6, 100);
    const ring = circle.geometry.coordinates[0];
    const avgLon = ring.slice(0, -1).reduce((sum, c) => sum + c[0], 0) / (ring.length - 1);
    const avgLat = ring.slice(0, -1).reduce((sum, c) => sum + c[1], 0) / (ring.length - 1);
    expect(avgLon).toBeCloseTo(-122.4, 5);
    expect(avgLat).toBeCloseTo(47.6, 5);
  });

  it('widens longitude spacing away from the equator so the circle stays round', () => {
    const equator = createCirclePolygon(0, 0, 1000);
    const north = createCirclePolygon(0, 60, 1000);
    const lonSpan = (feature: GeoJSON.Feature<GeoJSON.Polygon>) => {
      const lons = feature.geometry.coordinates[0].map((c) => c[0]);
      return Math.max(...lons) - Math.min(...lons);
    };
    // cos(60°) = 0.5 → the ring must span about twice as many degrees of longitude
    expect(lonSpan(north) / lonSpan(equator)).toBeCloseTo(2, 1);
  });
});
