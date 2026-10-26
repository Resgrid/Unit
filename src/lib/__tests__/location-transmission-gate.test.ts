import { distanceInMeters, LocationTransmissionGate } from '@/lib/location-transmission-gate';

describe('distanceInMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceInMeters({ latitude: 37.7749, longitude: -122.4194 }, { latitude: 37.7749, longitude: -122.4194 })).toBe(0);
  });

  it('measures about 111km per degree of latitude', () => {
    expect(distanceInMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111195, -1);
  });

  it('shrinks a degree of longitude towards the poles', () => {
    const atEquator = distanceInMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
    const at60North = distanceInMeters({ latitude: 60, longitude: 0 }, { latitude: 60, longitude: 1 });

    expect(at60North).toBeCloseTo(atEquator / 2, -2);
  });
});

describe('LocationTransmissionGate', () => {
  const options = { minIntervalMs: 15_000, minDistanceMeters: 25, stationaryIntervalMs: 300_000 };
  const origin = { latitude: 37.7749, longitude: -122.4194 };
  // ~111m north of origin.
  const moved = { latitude: 37.7759, longitude: -122.4194 };
  // ~11m north of origin: GPS jitter.
  const jitter = { latitude: 37.775, longitude: -122.4194 };

  let gate: LocationTransmissionGate;

  beforeEach(() => {
    gate = new LocationTransmissionGate(options);
  });

  it('sends the first fix', () => {
    expect(gate.evaluate('unit-1', origin, 0)).toEqual({ action: 'send' });
  });

  it('defers a moving fix inside the interval until the interval expires', () => {
    gate.record('unit-1', origin, 0);

    expect(gate.evaluate('unit-1', moved, 4_000)).toEqual({ action: 'defer', retryInMs: 11_000 });
  });

  it('sends a moving fix once the interval has elapsed', () => {
    gate.record('unit-1', origin, 0);

    expect(gate.evaluate('unit-1', moved, 15_000)).toEqual({ action: 'send' });
  });

  it('skips jitter until the stationary interval elapses', () => {
    gate.record('unit-1', origin, 0);

    expect(gate.evaluate('unit-1', jitter, 60_000)).toEqual({ action: 'skip' });
    expect(gate.evaluate('unit-1', jitter, 299_999)).toEqual({ action: 'skip' });
    expect(gate.evaluate('unit-1', jitter, 300_000)).toEqual({ action: 'send' });
  });

  it('sends immediately for a different unit', () => {
    gate.record('unit-1', origin, 0);

    expect(gate.evaluate('unit-2', origin, 1_000)).toEqual({ action: 'send' });
  });

  it('starts over when the clock goes backwards', () => {
    gate.record('unit-1', origin, 100_000);

    expect(gate.evaluate('unit-1', origin, 50_000)).toEqual({ action: 'send' });
  });

  it('measures distance from the last recorded transmission', () => {
    gate.record('unit-1', origin, 0);
    gate.record('unit-1', moved, 15_000);

    // Back at origin is a move relative to the last transmission.
    expect(gate.evaluate('unit-1', origin, 30_000)).toEqual({ action: 'send' });
    expect(gate.evaluate('unit-1', moved, 30_000)).toEqual({ action: 'skip' });
  });

  describe('after a rejection', () => {
    it('retries an unmoved position once the interval allows, instead of treating it as delivered', () => {
      const record = gate.record('unit-1', origin, 0);
      gate.markRejected(record);

      expect(gate.evaluate('unit-1', origin, 5_000)).toEqual({ action: 'defer', retryInMs: 10_000 });
      expect(gate.evaluate('unit-1', origin, 15_000)).toEqual({ action: 'send' });
    });

    it('ignores a rejection for a transmission that has since been superseded', () => {
      const first = gate.record('unit-1', origin, 0);
      gate.record('unit-1', moved, 15_000);
      gate.markRejected(first);

      expect(gate.evaluate('unit-1', moved, 20_000)).toEqual({ action: 'skip' });
    });
  });

  it('forgets everything on reset', () => {
    gate.record('unit-1', origin, 0);
    gate.reset();

    expect(gate.evaluate('unit-1', origin, 1_000)).toEqual({ action: 'send' });
  });
});
