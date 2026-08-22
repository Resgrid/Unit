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

  const pins = [makePin({ Id: 'call-1', Type: 0, ImagePath: 'call', Title: 'Structure Fire' }), makePin({ Id: 'unit-1', Type: 1, Title: 'Engine 1' }), makePin({ Id: 'call-2', Type: 0, ImagePath: 'call', Title: 'MVA' })];

  it('renders a marker per pin', () => {
    const { getByTestId, unmount } = render(<MapPins pins={pins} />);
    expect(getByTestId('pin-call-1')).toBeTruthy();
    expect(getByTestId('pin-unit-1')).toBeTruthy();
    expect(getByTestId('pin-call-2')).toBeTruthy();
    unmount();
  });

  it('renders the active call last so it stacks above other markers', () => {
    const { toJSON, unmount } = render(<MapPins pins={pins} activeCallId="call-1" />);
    const tree = toJSON() as any[];
    const ids = tree.map((node) => node.props.testID);
    expect(ids[ids.length - 1]).toBe('pin-call-1');
    expect(ids).toHaveLength(3);
    unmount();
  });

  // Marker stacking is fixed at attach time (DOM insertion order on web, an
  // imperative MarkerView attach on iOS), so reordering keyed children alone
  // updates the ring but never restacks. The active flag is folded into the pin
  // key so the pin whose active state changed remounts and re-attaches on top.
  it('remounts a pin when it becomes the active call so it re-attaches on top', () => {
    const { rerender, unmount } = render(<MapPins pins={pins} activeCallId={undefined} />);
    expect(mockMarkerMounts['pin-call-1']).toBe(1);
    expect(mockMarkerMounts['pin-unit-1']).toBe(1);

    rerender(<MapPins pins={pins} activeCallId="call-1" />);

    // The newly active pin re-attached...
    expect(mockMarkerMounts['pin-call-1']).toBe(2);
    // ...and unrelated pins did not churn.
    expect(mockMarkerMounts['pin-unit-1']).toBe(1);
    unmount();
  });

  it('remounts both the old and new active pin when the active call changes mid-session', () => {
    const { getByTestId, getAllByTestId, rerender, unmount } = render(<MapPins pins={pins} activeCallId="call-1" />);
    expect(mockMarkerMounts['pin-call-1']).toBe(1);
    expect(mockMarkerMounts['pin-call-2']).toBe(1);

    rerender(<MapPins pins={pins} activeCallId="call-2" />);

    // Both change active state, so both re-attach — the new active call ends up
    // attached last, above the one it replaced.
    expect(mockMarkerMounts['pin-call-1']).toBe(2);
    expect(mockMarkerMounts['pin-call-2']).toBe(2);
    expect(mockMarkerMounts['pin-unit-1']).toBe(1);

    // The highlight ring moved with it.
    expect(getAllByTestId('pin-active-ring')).toHaveLength(1);
    expect(getByTestId('pin-call-2')).toBeTruthy();
    unmount();
  });

  it('does not remount pins when an unrelated prop changes', () => {
    const onPinPress = jest.fn();
    const { rerender, unmount } = render(<MapPins pins={pins} activeCallId="call-1" onPinPress={onPinPress} />);
    const before = { ...mockMarkerMounts };

    rerender(<MapPins pins={pins} activeCallId="call-1" onPinPress={onPinPress} />);

    expect(mockMarkerMounts).toEqual(before);
    unmount();
  });

  it('highlights only the active call pin', () => {
    const { getAllByTestId, unmount } = render(<MapPins pins={pins} activeCallId="call-1" />);
    expect(getAllByTestId('pin-active-ring')).toHaveLength(1);
    unmount();
  });

  it('does not highlight a unit whose id happens to match the active call id', () => {
    const unitPins = [makePin({ Id: 'shared-id', Type: 1, Title: 'Engine 1' })];
    const { queryByTestId, unmount } = render(<MapPins pins={unitPins} activeCallId="shared-id" />);
    expect(queryByTestId('pin-active-ring')).toBeNull();
    unmount();
  });

  it('keeps original order when there is no active call', () => {
    const { toJSON, unmount } = render(<MapPins pins={pins} />);
    const tree = toJSON() as any[];
    const ids = tree.map((node) => node.props.testID);
    expect(ids).toEqual(['pin-call-1', 'pin-unit-1', 'pin-call-2']);
    unmount();
  });
});
