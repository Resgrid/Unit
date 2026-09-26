import { applyLiveLocations, diffLiveLocations, type LiveLocation, type LiveLocations, mergeLiveLocation, parseLiveLocationPayload } from '@/lib/live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

const RECEIVED_AT = 1_700_000_000_000;

const makePin = (overrides: Partial<MapMakerInfoData>): MapMakerInfoData => ({
  Id: 'u1',
  Longitude: -74.0,
  Latitude: 40.7,
  Title: 'Pin',
  zIndex: 0,
  ImagePath: 'engine_available',
  InfoWindowContent: '',
  Color: '',
  Type: 1,
  Marker: '',
  PoiImage: '',
  ...overrides,
});

const makeLocation = (overrides: Partial<LiveLocation>): LiveLocation => ({
  pinId: 'u1',
  latitude: 41,
  longitude: -73,
  timestamp: null,
  receivedAt: RECEIVED_AT,
  ...overrides,
});

describe('parseLiveLocationPayload', () => {
  it('parses a camelCase unit push into a u-prefixed pin id', () => {
    const result = parseLiveLocationPayload('unit', { departmentId: 1, unitId: '12', latitude: 39.5, longitude: -119.8, recordId: 'r1', timestamp: '2026-09-25T14:03:11.123Z' }, RECEIVED_AT);

    expect(result).toEqual({ pinId: 'u12', latitude: 39.5, longitude: -119.8, timestamp: Date.UTC(2026, 8, 25, 14, 3, 11, 123), receivedAt: RECEIVED_AT });
  });

  it('parses a personnel push and lower-cases the user id', () => {
    const result = parseLiveLocationPayload('personnel', { userId: 'AB12CD34-0000-4000-8000-ABCDEF123456', latitude: 1.5, longitude: 2.5 }, RECEIVED_AT);

    expect(result?.pinId).toBe('pab12cd34-0000-4000-8000-abcdef123456');
  });

  it('accepts PascalCase field names', () => {
    const result = parseLiveLocationPayload('unit', { UnitId: '7', Latitude: 10, Longitude: 20, Timestamp: '2026-09-25T14:00:00Z' }, RECEIVED_AT);

    expect(result).toEqual({ pinId: 'u7', latitude: 10, longitude: 20, timestamp: Date.UTC(2026, 8, 25, 14, 0, 0), receivedAt: RECEIVED_AT });
  });

  it('accepts the payload as a JSON string', () => {
    const result = parseLiveLocationPayload('personnel', JSON.stringify({ userId: 'abc', latitude: 5, longitude: 6 }), RECEIVED_AT);

    expect(result).toEqual({ pinId: 'pabc', latitude: 5, longitude: 6, timestamp: null, receivedAt: RECEIVED_AT });
  });

  it('accepts a numeric unit id', () => {
    expect(parseLiveLocationPayload('unit', { unitId: 42, latitude: 5, longitude: 6 }, RECEIVED_AT)?.pinId).toBe('u42');
  });

  it.each([
    ['a missing', undefined],
    ['a null', null],
    ['an empty', ''],
    ['an unparseable', 'not a date'],
  ])('treats %s timestamp as unknown', (_label, timestamp) => {
    expect(parseLiveLocationPayload('unit', { unitId: '1', latitude: 5, longitude: 6, timestamp }, RECEIVED_AT)?.timestamp).toBeNull();
  });

  it('reads a timestamp without a zone designator as UTC', () => {
    expect(parseLiveLocationPayload('unit', { unitId: '1', latitude: 5, longitude: 6, timestamp: '2026-09-25T14:03:11' }, RECEIVED_AT)?.timestamp).toBe(Date.UTC(2026, 8, 25, 14, 3, 11));
  });

  it.each([
    ['latitude above 90', { latitude: 90.5, longitude: 0.5 }],
    ['latitude below -90', { latitude: -91, longitude: 0.5 }],
    ['longitude above 180', { latitude: 1, longitude: 180.1 }],
    ['longitude below -180', { latitude: 1, longitude: -181 }],
    ['non-finite latitude', { latitude: Number.NaN, longitude: 1 }],
    ['infinite longitude', { latitude: 1, longitude: Number.POSITIVE_INFINITY }],
    ['non-numeric coordinates', { latitude: 'north', longitude: 'west' }],
    ['missing coordinates', {}],
    ['0,0', { latitude: 0, longitude: 0 }],
  ])('rejects %s', (_label, coords) => {
    expect(parseLiveLocationPayload('unit', { unitId: '1', ...coords }, RECEIVED_AT)).toBeNull();
  });

  it.each([
    ['null', null],
    ['a number', 12],
    ['an array', [1, 2]],
    ['malformed JSON', '{not json'],
  ])('rejects a payload that is %s', (_label, payload) => {
    expect(parseLiveLocationPayload('unit', payload, RECEIVED_AT)).toBeNull();
  });

  it('rejects a push without an entity id', () => {
    expect(parseLiveLocationPayload('unit', { unitId: '  ', latitude: 1, longitude: 2 }, RECEIVED_AT)).toBeNull();
    expect(parseLiveLocationPayload('personnel', { unitId: '12', latitude: 1, longitude: 2 }, RECEIVED_AT)).toBeNull();
  });
});

describe('mergeLiveLocation', () => {
  it('adds a position for a new pin without mutating the input', () => {
    const current: LiveLocations = {};
    const update = makeLocation({ pinId: 'u1' });

    const next = mergeLiveLocation(current, update);

    expect(next).toEqual({ u1: update });
    expect(current).toEqual({});
  });

  it('keeps positions per pin so a burst of pushes loses none of them', () => {
    let state: LiveLocations = {};
    state = mergeLiveLocation(state, makeLocation({ pinId: 'u1' }));
    state = mergeLiveLocation(state, makeLocation({ pinId: 'u2' }));
    state = mergeLiveLocation(state, makeLocation({ pinId: 'pabc' }));

    expect(Object.keys(state).sort()).toEqual(['pabc', 'u1', 'u2']);
  });

  it('ignores an update whose fix is older than the one already held', () => {
    const current: LiveLocations = { u1: makeLocation({ timestamp: 2000, latitude: 41 }) };

    const next = mergeLiveLocation(current, makeLocation({ timestamp: 1000, latitude: 42 }));

    expect(next).toBe(current);
  });

  it('applies a newer fix', () => {
    const current: LiveLocations = { u1: makeLocation({ timestamp: 1000, latitude: 41 }) };
    const update = makeLocation({ timestamp: 2000, latitude: 42 });

    expect(mergeLiveLocation(current, update).u1).toBe(update);
  });

  it('always applies an update with an unknown timestamp', () => {
    const current: LiveLocations = { u1: makeLocation({ timestamp: 5000, latitude: 41 }) };
    const update = makeLocation({ timestamp: null, latitude: 43 });

    expect(mergeLiveLocation(current, update).u1).toBe(update);
  });

  it('applies a timestamped update over one with an unknown timestamp', () => {
    const current: LiveLocations = { u1: makeLocation({ timestamp: null, latitude: 41 }) };
    const update = makeLocation({ timestamp: 1, latitude: 43 });

    expect(mergeLiveLocation(current, update).u1).toBe(update);
  });
});

describe('diffLiveLocations', () => {
  it('returns only new or replaced entries', () => {
    const kept = makeLocation({ pinId: 'u1' });
    const previous: LiveLocations = { u1: kept, u2: makeLocation({ pinId: 'u2' }) };
    const replaced = makeLocation({ pinId: 'u2', latitude: 10 });
    const added = makeLocation({ pinId: 'u3' });

    expect(diffLiveLocations(previous, { u1: kept, u2: replaced, u3: added })).toEqual({ u2: replaced, u3: added });
  });

  it('returns an empty object for the same map', () => {
    const same: LiveLocations = { u1: makeLocation({}) };
    expect(diffLiveLocations(same, same)).toEqual({});
  });
});

describe('applyLiveLocations', () => {
  const unitPin = makePin({ Id: 'u1', Type: 1, Latitude: 40, Longitude: -74 });
  const personPin = makePin({ Id: 'pAB12-CD', Type: 3, Latitude: 30, Longitude: -80 });
  const callPin = makePin({ Id: 'c9', Type: 0, Latitude: 20, Longitude: -90 });
  const stationPin = makePin({ Id: 's4', Type: 2, Latitude: 10, Longitude: -100 });
  const pins = [callPin, unitPin, personPin, stationPin];

  it('returns the same array when there are no live locations', () => {
    const result = applyLiveLocations(pins, {});
    expect(result.pins).toBe(pins);
    expect(result.unknownPinIds).toEqual([]);
  });

  it('returns the same array when the live position equals the pin position', () => {
    const result = applyLiveLocations(pins, { u1: makeLocation({ pinId: 'u1', latitude: 40, longitude: -74 }) });
    expect(result.pins).toBe(pins);
    expect(result.unknownPinIds).toEqual([]);
  });

  it('moves a pin immutably, replacing only the moved pin object', () => {
    const result = applyLiveLocations(pins, { u1: makeLocation({ pinId: 'u1', latitude: 41.5, longitude: -73.5 }) });

    expect(result.pins).not.toBe(pins);
    expect(result.pins[1]).toEqual({ ...unitPin, Latitude: 41.5, Longitude: -73.5 });
    expect(result.pins[1]).not.toBe(unitPin);
    // Untouched pins keep their identity so their memoized markers do not re-render.
    expect(result.pins[0]).toBe(callPin);
    expect(result.pins[2]).toBe(personPin);
    expect(result.pins[3]).toBe(stationPin);
    // The input is never mutated.
    expect(unitPin.Latitude).toBe(40);
    expect(pins[1]).toBe(unitPin);
  });

  it('matches personnel pins case-insensitively', () => {
    const result = applyLiveLocations(pins, { 'pab12-cd': makeLocation({ pinId: 'pab12-cd', latitude: 31, longitude: -81 }) });

    expect(result.pins[2]).toEqual({ ...personPin, Latitude: 31, Longitude: -81 });
    expect(result.unknownPinIds).toEqual([]);
  });

  it('never adds pins and reports positions without a pin as unknown', () => {
    const result = applyLiveLocations(pins, { u99: makeLocation({ pinId: 'u99' }), u1: makeLocation({ pinId: 'u1', latitude: 42 }) });

    expect(result.pins).toHaveLength(pins.length);
    expect(result.pins.some((pin) => pin.Id === 'u99')).toBe(false);
    expect(result.unknownPinIds).toEqual(['u99']);
  });

  it('only moves unit and personnel pins', () => {
    // A call or station pin whose id happens to look like a unit/personnel id stays put.
    const lookalikes = [makePin({ Id: 'u1', Type: 0, Latitude: 1, Longitude: 1 }), makePin({ Id: 'pabc', Type: 2, Latitude: 1, Longitude: 1 })];

    const result = applyLiveLocations(lookalikes, { u1: makeLocation({ pinId: 'u1' }), pabc: makeLocation({ pinId: 'pabc' }) });

    expect(result.pins).toBe(lookalikes);
    expect(result.unknownPinIds.sort()).toEqual(['pabc', 'u1']);
  });

  it('only applies positions received at or after minReceivedAt', () => {
    const live: LiveLocations = {
      u1: makeLocation({ pinId: 'u1', latitude: 45, receivedAt: 1000 }),
      'pab12-cd': makeLocation({ pinId: 'pab12-cd', latitude: 35, receivedAt: 2000 }),
    };

    const result = applyLiveLocations(pins, live, { minReceivedAt: 2000 });

    expect(result.pins[1]).toBe(unitPin);
    expect(result.pins[2].Latitude).toBe(35);
  });

  it('keeps the newer position when an older fix arrives later', () => {
    let live: LiveLocations = {};
    live = mergeLiveLocation(live, makeLocation({ pinId: 'u1', latitude: 42, timestamp: 2000 }));
    live = mergeLiveLocation(live, makeLocation({ pinId: 'u1', latitude: 41, timestamp: 1000 }));

    expect(applyLiveLocations(pins, live).pins[1].Latitude).toBe(42);
  });
});
