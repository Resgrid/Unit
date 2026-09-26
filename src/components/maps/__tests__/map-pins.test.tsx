import { render } from '@testing-library/react-native';
import React from 'react';

import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import MapPins from '../map-pins';

// Counts how many times each marker has been mounted. Stacking order is fixed
// when a marker attaches to the map, so "the active pin re-attaches" is only
// observable as a remount of that marker.
const mockMarkerMounts: Record<string, number> = {};

jest.mock('@/components/maps/mapbox', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const MarkerView = ({ children, ...props }: any) => {
    ReactActual.useEffect(() => {
      mockMarkerMounts[props.id] = (mockMarkerMounts[props.id] ?? 0) + 1;
    }, []);
    return ReactActual.createElement(View, { testID: props.id, ...props }, children);
  };
  return {
    __esModule: true,
    default: { MarkerView },
    PointAnnotation: 'PointAnnotation',
  };
});

jest.mock('nativewind', () => ({
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
  cssInterop: jest.fn((Component: any) => Component),
}));

const makePin = (overrides: Partial<MapMakerInfoData>): MapMakerInfoData => ({
  Id: 'pin-id',
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

describe('MapPins', () => {
  beforeEach(() => {
    Object.keys(mockMarkerMounts).forEach((key) => delete mockMarkerMounts[key]);
  });

  // Pin ids as the Core map API sends them (`c` = call, `u` = unit); stores hold the bare call id.
  const pins = [makePin({ Id: 'c101', Type: 0, ImagePath: 'call', Title: 'Structure Fire' }), makePin({ Id: 'u7', Type: 1, Title: 'Engine 1' }), makePin({ Id: 'c102', Type: 0, ImagePath: 'call', Title: 'MVA' })];

  it('renders a marker per pin', () => {
    const { getByTestId, unmount } = render(<MapPins pins={pins} />);
    expect(getByTestId('pin-c101')).toBeTruthy();
    expect(getByTestId('pin-u7')).toBeTruthy();
    expect(getByTestId('pin-c102')).toBeTruthy();
    unmount();
  });

  it('renders the active call last so it stacks above other markers', () => {
    const { toJSON, unmount } = render(<MapPins pins={pins} activeCallId="101" />);
    const tree = toJSON() as any[];
    const ids = tree.map((node) => node.props.testID);
    expect(ids[ids.length - 1]).toBe('pin-c101');
    expect(ids).toHaveLength(3);
    unmount();
  });

  // Marker stacking is fixed at attach time (DOM insertion order on web, an
  // imperative MarkerView attach on iOS), so reordering keyed children alone
  // updates the ring but never restacks. The active flag is folded into the pin
  // key so the pin whose active state changed remounts and re-attaches on top.
  it('remounts a pin when it becomes the active call so it re-attaches on top', () => {
    const { rerender, unmount } = render(<MapPins pins={pins} activeCallId={undefined} />);
    expect(mockMarkerMounts['pin-c101']).toBe(1);
    expect(mockMarkerMounts['pin-u7']).toBe(1);

    rerender(<MapPins pins={pins} activeCallId="101" />);

    // The newly active pin re-attached...
    expect(mockMarkerMounts['pin-c101']).toBe(2);
    // ...and unrelated pins did not churn.
    expect(mockMarkerMounts['pin-u7']).toBe(1);
    unmount();
  });

  it('remounts both the old and new active pin when the active call changes mid-session', () => {
    const { getByTestId, getAllByTestId, rerender, unmount } = render(<MapPins pins={pins} activeCallId="101" />);
    expect(mockMarkerMounts['pin-c101']).toBe(1);
    expect(mockMarkerMounts['pin-c102']).toBe(1);

    rerender(<MapPins pins={pins} activeCallId="102" />);

    // Both change active state, so both re-attach — the new active call ends up
    // attached last, above the one it replaced.
    expect(mockMarkerMounts['pin-c101']).toBe(2);
    expect(mockMarkerMounts['pin-c102']).toBe(2);
    expect(mockMarkerMounts['pin-u7']).toBe(1);

    // The highlight ring moved with it.
    expect(getAllByTestId('pin-active-ring')).toHaveLength(1);
    expect(getByTestId('pin-c102')).toBeTruthy();
    unmount();
  });

  it('does not remount pins when an unrelated prop changes', () => {
    const onPinPress = jest.fn();
    const { rerender, unmount } = render(<MapPins pins={pins} activeCallId="101" onPinPress={onPinPress} />);
    const before = { ...mockMarkerMounts };

    rerender(<MapPins pins={pins} activeCallId="101" onPinPress={onPinPress} />);

    expect(mockMarkerMounts).toEqual(before);
    unmount();
  });

  // Realtime positions replace a moved pin with a new object at new coordinates. The marker must
  // move in place: its id/key never include coordinates, so nothing is torn down and recreated.
  it('moves a pin in place without remounting any marker when its position changes', () => {
    const { rerender, getByTestId, unmount } = render(<MapPins pins={pins} />);
    const before = { ...mockMarkerMounts };

    const movedPins = [pins[0], { ...pins[1], Latitude: 41.5, Longitude: -73.25 }, pins[2]];
    rerender(<MapPins pins={movedPins} />);

    expect(mockMarkerMounts).toEqual(before);
    expect(getByTestId('pin-u7').props.coordinate).toEqual([-73.25, 41.5]);
    unmount();
  });

  it('highlights only the active call pin', () => {
    const { getAllByTestId, unmount } = render(<MapPins pins={pins} activeCallId="101" />);
    expect(getAllByTestId('pin-active-ring')).toHaveLength(1);
    unmount();
  });

  it('does not highlight a unit whose id happens to match the active call id', () => {
    const unitPins = [makePin({ Id: 'u101', Type: 1, Title: 'Engine 1' })];
    const { queryByTestId, unmount } = render(<MapPins pins={unitPins} activeCallId="101" />);
    expect(queryByTestId('pin-active-ring')).toBeNull();
    unmount();
  });

  it('highlights a call pin from a server that sends unprefixed ids', () => {
    const legacyPins = [makePin({ Id: '101', Type: 0, ImagePath: 'call', Title: 'Structure Fire' })];
    const { getAllByTestId, unmount } = render(<MapPins pins={legacyPins} activeCallId="101" />);
    expect(getAllByTestId('pin-active-ring')).toHaveLength(1);
    unmount();
  });

  it('keeps original order when there is no active call', () => {
    const { toJSON, unmount } = render(<MapPins pins={pins} />);
    const tree = toJSON() as any[];
    const ids = tree.map((node) => node.props.testID);
    expect(ids).toEqual(['pin-c101', 'pin-u7', 'pin-c102']);
    unmount();
  });
});
