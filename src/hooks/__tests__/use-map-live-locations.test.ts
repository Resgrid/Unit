import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';

import { type LiveLocation } from '@/lib/live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { applyLiveLocationsSince, UNKNOWN_PIN_REFRESH_COOLDOWN_MS, UNKNOWN_PIN_REFRESH_DELAY_MS, useMapLiveLocations } from '../use-map-live-locations';

// A real zustand store with just the slice the hook reads, so selector subscriptions behave as in the app.
jest.mock('@/stores/signalr/signalr-store', () => {
  const { create } = jest.requireActual('zustand');
  return { useSignalRStore: create(() => ({ liveLocations: {}, geolocationJoinCount: 0 })) };
});

jest.mock('@/lib/logging', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

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
  receivedAt: Date.now(),
  ...overrides,
});

const push = (location: LiveLocation) => {
  act(() => {
    useSignalRStore.setState((state: { liveLocations: Record<string, LiveLocation> }) => ({ liveLocations: { ...state.liveLocations, [location.pinId]: location } }));
  });
};

const setJoinCount = (geolocationJoinCount: number) => {
  act(() => {
    useSignalRStore.setState({ geolocationJoinCount });
  });
};

let mockRenderCount = 0;

const useHarness = (initialPins: MapMakerInfoData[], requestRefresh?: () => void) => {
  mockRenderCount += 1;
  const [pins, setPins] = useState(initialPins);
  useMapLiveLocations(pins, setPins, requestRefresh);
  return { pins, setPins };
};

describe('useMapLiveLocations', () => {
  const unitPin = makePin({ Id: 'u1', Type: 1, Latitude: 40, Longitude: -74 });
  const personPin = makePin({ Id: 'pABC', Type: 3, Latitude: 30, Longitude: -80 });
  const callPin = makePin({ Id: 'c5', Type: 0, Latitude: 20, Longitude: -90 });
  const initialPins = [callPin, unitPin, personPin];

  beforeEach(() => {
    jest.useFakeTimers();
    useSignalRStore.setState({ liveLocations: {}, geolocationJoinCount: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves a unit pin in place when its live location arrives', () => {
    const { result, unmount } = renderHook(() => useHarness(initialPins));

    push(makeLocation({ pinId: 'u1', latitude: 41.25, longitude: -73.5 }));

    expect(result.current.pins).toHaveLength(3);
    expect(result.current.pins[1]).toEqual({ ...unitPin, Latitude: 41.25, Longitude: -73.5 });
    // Pins that did not move keep their identity so their memoized markers do not re-render.
    expect(result.current.pins[0]).toBe(callPin);
    expect(result.current.pins[2]).toBe(personPin);
    unmount();
  });

  it('moves personnel pins matched case-insensitively', () => {
    const { result, unmount } = renderHook(() => useHarness(initialPins));

    push(makeLocation({ pinId: 'pabc', latitude: 31, longitude: -81 }));

    expect(result.current.pins[2]).toEqual({ ...personPin, Latitude: 31, Longitude: -81 });
    unmount();
  });

  it('does not re-render the map for pushes that move nothing', () => {
    const { unmount } = renderHook(() => useHarness(initialPins, jest.fn()));
    const rendersAfterMount = mockRenderCount;

    // Same position as the pin, and a pin the map does not have.
    push(makeLocation({ pinId: 'u1', latitude: 40, longitude: -74 }));
    push(makeLocation({ pinId: 'u99' }));

    expect(mockRenderCount).toBe(rendersAfterMount);

    push(makeLocation({ pinId: 'u1', latitude: 40.5, longitude: -74 }));
    expect(mockRenderCount).toBe(rendersAfterMount + 1);
    unmount();
  });

  it('keeps the same pins array when a push does not move anything', () => {
    const { result, unmount } = renderHook(() => useHarness(initialPins));
    const before = result.current.pins;

    push(makeLocation({ pinId: 'u1', latitude: 40, longitude: -74 }));

    expect(result.current.pins).toBe(before);
    unmount();
  });

  it('does not apply positions that were already held when the map mounted', () => {
    useSignalRStore.setState({ liveLocations: { u1: makeLocation({ pinId: 'u1', latitude: 45 }) } });

    const { result, unmount } = renderHook(() => useHarness(initialPins));

    expect(result.current.pins).toBe(initialPins);
    unmount();
  });

  it('does not roll a refetched snapshot back to an older live position', () => {
    const { result, unmount } = renderHook(() => useHarness(initialPins));

    push(makeLocation({ pinId: 'u1', latitude: 41 }));
    expect(result.current.pins[1].Latitude).toBe(41);

    // A later REST refetch replaces the pins with a newer position for the unit.
    const refetched = [callPin, makePin({ Id: 'u1', Type: 1, Latitude: 42, Longitude: -74 }), personPin];
    act(() => {
      result.current.setPins(refetched);
    });

    expect(result.current.pins).toBe(refetched);

    // An unrelated push must not re-apply the older unit position either.
    push(makeLocation({ pinId: 'pabc', latitude: 31 }));
    expect(result.current.pins[1].Latitude).toBe(42);
    expect(result.current.pins[2].Latitude).toBe(31);
    unmount();
  });

  it('never adds a pin and requests one coalesced refetch for pins missing from the map', () => {
    const requestRefresh = jest.fn();
    const { result, unmount } = renderHook(() => useHarness(initialPins, requestRefresh));

    push(makeLocation({ pinId: 'u99' }));
    push(makeLocation({ pinId: 'u98' }));
    push(makeLocation({ pinId: 'pdef' }));

    expect(result.current.pins).toBe(initialPins);
    expect(requestRefresh).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_DELAY_MS);
    });

    expect(requestRefresh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('lets each unknown pin request a refetch at most once per cooldown', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderHook(() => useHarness(initialPins, requestRefresh));

    push(makeLocation({ pinId: 'u99', latitude: 10 }));
    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_DELAY_MS);
    });
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    // The viewer may not be allowed to see u99; its next pushes must not keep refetching.
    push(makeLocation({ pinId: 'u99', latitude: 11 }));
    push(makeLocation({ pinId: 'u99', latitude: 12 }));
    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_DELAY_MS * 2);
    });
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_COOLDOWN_MS);
    });
    push(makeLocation({ pinId: 'u99', latitude: 13 }));
    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_DELAY_MS);
    });
    expect(requestRefresh).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not treat pushes as unknown before the map has any pins', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderHook(() => useHarness([], requestRefresh));

    push(makeLocation({ pinId: 'u1' }));
    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_DELAY_MS);
    });

    expect(requestRefresh).not.toHaveBeenCalled();
    unmount();
  });

  it('drops a pending unknown-pin refetch on unmount', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderHook(() => useHarness(initialPins, requestRefresh));

    push(makeLocation({ pinId: 'u99' }));
    unmount();
    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_DELAY_MS);
    });

    expect(requestRefresh).not.toHaveBeenCalled();
  });

  it('requests a catch-up refetch when the hub re-joins, but not for the first join', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderHook(() => useHarness(initialPins, requestRefresh));

    setJoinCount(1);
    expect(requestRefresh).not.toHaveBeenCalled();

    setJoinCount(2);
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    setJoinCount(3);
    expect(requestRefresh).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('requests a catch-up refetch for a re-join after mounting on an already joined hub', () => {
    useSignalRStore.setState({ geolocationJoinCount: 1 });
    const requestRefresh = jest.fn();
    const { unmount } = renderHook(() => useHarness(initialPins, requestRefresh));

    expect(requestRefresh).not.toHaveBeenCalled();

    setJoinCount(2);
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe('applyLiveLocationsSince', () => {
  it('re-applies only positions received at or after the fetch started', () => {
    useSignalRStore.setState({
      liveLocations: {
        u1: makeLocation({ pinId: 'u1', latitude: 45, receivedAt: 1000 }),
        u2: makeLocation({ pinId: 'u2', latitude: 46, receivedAt: 3000 }),
      },
    });
    const pins = [makePin({ Id: 'u1', Type: 1, Latitude: 40 }), makePin({ Id: 'u2', Type: 1, Latitude: 40 })];

    const result = applyLiveLocationsSince(pins, 2000);

    expect(result[0]).toBe(pins[0]);
    expect(result[1].Latitude).toBe(46);
  });

  it('returns the fetched array untouched when nothing newer was pushed', () => {
    useSignalRStore.setState({ liveLocations: { u1: makeLocation({ pinId: 'u1', latitude: 45, receivedAt: 1000 }) } });
    const pins = [makePin({ Id: 'u1', Type: 1, Latitude: 40 })];

    expect(applyLiveLocationsSince(pins, 2000)).toBe(pins);
  });
});
