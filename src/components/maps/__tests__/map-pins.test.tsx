import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import { MAP_ICONS } from '@/constants/map-icons';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import MapPins from '../map-pins';
import PinMarker from '../pin-marker';

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

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
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

  describe('unit type icons', () => {
    // The type icon is decorative (hidden from accessibility services), so queries must opt in to hidden elements.
    const hidden = { includeHiddenElements: true };
    const ICON_URL = 'https://cdn.example.test/unit-types/7/icon.png';

    it('draws a unit pin with its uploaded type icon', () => {
      const unitPins = [makePin({ Id: 'u7', Type: 1, ImagePath: 'ambulance', Title: 'Ambulance 1', IconUrl: ICON_URL })];
      const { getByTestId, UNSAFE_queryAllByType, unmount } = render(<MapPins pins={unitPins} />);

      const icon = getByTestId('pin-type-icon', hidden);
      expect(icon.props.source).toEqual({ uri: ICON_URL });
      expect(icon.props.style).toEqual({ width: 32, height: 32 });
      expect(icon.props.contentFit).toBe('contain');
      expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
      unmount();
    });

    it('falls back to the bundled pin when the uploaded icon fails to load', () => {
      const unitPins = [makePin({ Id: 'u7', Type: 1, ImagePath: 'ambulance', Title: 'Ambulance 1', IconUrl: ICON_URL })];
      const { getByTestId, queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={unitPins} />);

      act(() => {
        fireEvent(getByTestId('pin-type-icon', hidden), 'error', { error: 'boom' });
      });

      expect(queryByTestId('pin-type-icon', hidden)).toBeNull();
      expect(UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.ambulance.uri);
      unmount();
    });

    it('uses the bundled pin for a unit without an uploaded icon (older servers)', () => {
      const unitPins = [makePin({ Id: 'u7', Type: 1, ImagePath: 'cartwo', Title: 'MUG 1' })];
      const { queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={unitPins} />);

      expect(queryByTestId('pin-type-icon', hidden)).toBeNull();
      expect(UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.cartwo.uri);
      unmount();
    });

    it('draws a call pin with its uploaded type icon, keeping the active ring', () => {
      const callPins = [makePin({ Id: 'c101', Type: 0, ImagePath: 'call', Title: 'Structure Fire', IconUrl: ICON_URL })];
      const { getByTestId, getAllByTestId, UNSAFE_queryAllByType, unmount } = render(<MapPins pins={callPins} activeCallId="101" />);

      const icon = getByTestId('pin-type-icon', hidden);
      expect(icon.props.source).toEqual({ uri: ICON_URL });
      expect(icon.props.style).toEqual({ width: 40, height: 40 });
      expect(getAllByTestId('pin-active-ring')).toHaveLength(1);
      expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
      unmount();
    });

    it('uses the bundled call icon when the call type has no upload', () => {
      const callPins = [makePin({ Id: 'c101', Type: 0, ImagePath: 'call', Title: 'Structure Fire' })];
      const { queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={callPins} />);

      expect(queryByTestId('pin-type-icon', hidden)).toBeNull();
      expect(UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.call.uri);
      unmount();
    });
  });

  // Personnel pins (Type 3, `p{UserId}`) carry the icon of the first role the person holds, in the
  // department's role order, that has an upload.
  describe('personnel role icons', () => {
    const hidden = { includeHiddenElements: true };
    const ROLE_ICON_URL = 'https://cdn.example.test/roles/5/icon.png';
    const PERSON_PIN_ID = 'p6f1c2a3b-0000-4000-8000-000000000001';
    const makePersonPin = (overrides: Partial<MapMakerInfoData> = {}) => makePin({ Id: PERSON_PIN_ID, Type: 3, ImagePath: 'Person_RespondingCall', Title: 'Jane Smith', ...overrides });

    it('draws a personnel pin with its role icon, the same size as other uploaded pins', () => {
      const { getByTestId, UNSAFE_queryAllByType, unmount } = render(<MapPins pins={[makePersonPin({ IconUrl: ROLE_ICON_URL })]} />);

      const icon = getByTestId('pin-type-icon', hidden);
      expect(icon.props.source).toEqual({ uri: ROLE_ICON_URL });
      expect(icon.props.style).toEqual({ width: 32, height: 32 });
      expect(icon.props.contentFit).toBe('contain');
      expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
      // Personnel pins are centered on the person's position, like unit and call pins.
      expect(getByTestId(`pin-${PERSON_PIN_ID}`).props.anchor).toEqual({ x: 0.5, y: 0.5 });
      unmount();
    });

    it('falls back to the bundled person pin when the role icon fails to load', () => {
      const { getByTestId, queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={[makePersonPin({ IconUrl: ROLE_ICON_URL })]} />);

      act(() => {
        fireEvent(getByTestId('pin-type-icon', hidden), 'error', { error: 'boom' });
      });

      expect(queryByTestId('pin-type-icon', hidden)).toBeNull();
      const bundled = UNSAFE_getByType(Image);
      expect(bundled.props.source).toBe(MAP_ICONS.person_respondingcall.uri);
      expect(bundled.props.style).toEqual(expect.arrayContaining([{ width: 32, height: 32 }]));
      unmount();
    });

    it('draws the bundled person pin, unchanged, when no role has an icon (or on older servers)', () => {
      const withoutIcon = render(<MapPins pins={[makePersonPin({ IconUrl: null })]} />);
      expect(withoutIcon.queryByTestId('pin-type-icon', hidden)).toBeNull();
      // The bundled pin exactly as it was drawn before uploaded icons existed.
      const bundled = withoutIcon.UNSAFE_getByType(Image);
      expect(bundled.props.source).toBe(MAP_ICONS.person_respondingcall.uri);
      expect(bundled.props.fadeDuration).toBe(0);
      expect(bundled.props.style).toEqual([
        { overflow: 'visible', resizeMode: 'cover' },
        { width: 32, height: 32 },
      ]);
      const treeWithoutIcon = JSON.stringify(withoutIcon.toJSON());
      withoutIcon.unmount();

      // A pin from a server that does not send IconUrl at all renders exactly the same.
      const legacy = render(<MapPins pins={[makePersonPin()]} />);
      expect(JSON.stringify(legacy.toJSON())).toBe(treeWithoutIcon);
      legacy.unmount();
    });

    it('keeps the role icon when a live location moves the pin, without remounting the marker', () => {
      const pin = makePersonPin({ IconUrl: ROLE_ICON_URL });
      const { rerender, getByTestId, unmount } = render(<MapPins pins={[pin]} />);
      const before = { ...mockMarkerMounts };

      rerender(<MapPins pins={[{ ...pin, Latitude: 41.5, Longitude: -73.25 }]} />);

      expect(mockMarkerMounts).toEqual(before);
      expect(getByTestId(`pin-${PERSON_PIN_ID}`).props.coordinate).toEqual([-73.25, 41.5]);
      expect(getByTestId('pin-type-icon', hidden).props.source).toEqual({ uri: ROLE_ICON_URL });
      unmount();
    });

    it('does not retry a role icon that failed to load when the pin moves', () => {
      const pin = makePersonPin({ IconUrl: ROLE_ICON_URL });
      const { rerender, getByTestId, queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={[pin]} />);

      act(() => {
        fireEvent(getByTestId('pin-type-icon', hidden), 'error', { error: 'boom' });
      });
      rerender(<MapPins pins={[{ ...pin, Latitude: 41.5, Longitude: -73.25 }]} />);

      expect(queryByTestId('pin-type-icon', hidden)).toBeNull();
      expect(UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.person_respondingcall.uri);
      unmount();
    });
  });

  // `PinIconUrl`: the bundled pin recoloured to the call's priority or the unit's/person's status. Precedence is
  // uploaded icon (`IconUrl`) > styled pin (`PinIconUrl`) > bundled pin (`ImagePath`).
  describe('status / priority styled pins', () => {
    const hidden = { includeHiddenElements: true };
    const ICON_URL = 'https://cdn.example.test/unit-types/7/icon.png';
    const PIN_URL = 'https://api.example.test/api/v4/TypeIcons/Pins/Engine-responding?v=1';
    const NEXT_PIN_URL = 'https://api.example.test/api/v4/TypeIcons/Pins/Engine-onscene?v=1';
    const CALL_PIN_URL = 'https://api.example.test/api/v4/TypeIcons/Pins/Call-high?v=1';
    const makeUnitPin = (overrides: Partial<MapMakerInfoData> = {}) => makePin({ Id: 'u7', Type: 1, ImagePath: 'Engine_Responding', Title: 'Engine 1', ...overrides });

    it('draws the styled pin where and how the bundled pin is drawn: same box, cover fit, centered', () => {
      const { getByTestId, queryByTestId, UNSAFE_queryAllByType, unmount } = render(<MapPins pins={[makeUnitPin({ PinIconUrl: PIN_URL, IconStyle: 'responding' })]} />);

      const pin = getByTestId('pin-styled-icon', hidden);
      expect(pin.props.source).toEqual({ uri: PIN_URL });
      expect(pin.props.style).toEqual({ width: 32, height: 32 });
      // The bundled pin is drawn with resizeMode 'cover'; the styled copy has the same shape, so it is fitted the same way.
      expect(pin.props.contentFit).toBe('cover');
      // No tint: the styled pin already carries the status colour.
      expect(pin.props.tintColor).toBeUndefined();
      expect(queryByTestId('pin-type-icon', hidden)).toBeNull();
      expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
      expect(getByTestId('pin-u7').props.anchor).toEqual({ x: 0.5, y: 0.5 });
      unmount();
    });

    it('draws the uploaded icon instead of the styled pin when both are sent', () => {
      const { getByTestId, queryByTestId, unmount } = render(<MapPins pins={[makeUnitPin({ IconUrl: ICON_URL, PinIconUrl: PIN_URL, IconStyle: 'responding' })]} />);

      const icon = getByTestId('pin-type-icon', hidden);
      expect(icon.props.source).toEqual({ uri: ICON_URL });
      expect(icon.props.contentFit).toBe('contain');
      expect(queryByTestId('pin-styled-icon', hidden)).toBeNull();
      unmount();
    });

    it('falls back to the bundled pin when the styled pin fails to load', () => {
      const { getByTestId, queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={[makeUnitPin({ PinIconUrl: PIN_URL })]} />);

      act(() => {
        fireEvent(getByTestId('pin-styled-icon', hidden), 'error', { error: 'boom' });
      });

      expect(queryByTestId('pin-styled-icon', hidden)).toBeNull();
      const bundled = UNSAFE_getByType(Image);
      expect(bundled.props.source).toBe(MAP_ICONS.engine_responding.uri);
      expect(bundled.props.style).toEqual([
        { overflow: 'visible', resizeMode: 'cover' },
        { width: 32, height: 32 },
      ]);
      unmount();
    });

    it('falls back to the styled pin, then the bundled pin, when the uploaded icon fails to load', () => {
      const { getByTestId, queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={[makeUnitPin({ IconUrl: ICON_URL, PinIconUrl: PIN_URL })]} />);

      act(() => {
        fireEvent(getByTestId('pin-type-icon', hidden), 'error', { error: 'boom' });
      });
      expect(queryByTestId('pin-type-icon', hidden)).toBeNull();
      expect(getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: PIN_URL });

      act(() => {
        fireEvent(getByTestId('pin-styled-icon', hidden), 'error', { error: 'boom' });
      });
      expect(queryByTestId('pin-styled-icon', hidden)).toBeNull();
      expect(UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.engine_responding.uri);
      unmount();
    });

    it('draws the active call with its priority pin inside the highlight ring, at the active size', () => {
      const callPins = [makePin({ Id: 'c101', Type: 0, ImagePath: 'Call', Title: 'Structure Fire', PinIconUrl: CALL_PIN_URL, IconStyle: 'high' })];
      const { getByTestId, getAllByTestId, unmount } = render(<MapPins pins={callPins} activeCallId="101" />);

      const pin = getByTestId('pin-styled-icon', hidden);
      expect(pin.props.source).toEqual({ uri: CALL_PIN_URL });
      expect(pin.props.style).toEqual({ width: 40, height: 40 });
      expect(getAllByTestId('pin-active-ring')).toHaveLength(1);
      unmount();
    });

    it('redraws the pin in place when a refetch only changes its status pin', () => {
      const pin = makeUnitPin({ PinIconUrl: PIN_URL, IconStyle: 'responding' });
      const { getByTestId, rerender, unmount } = render(<MapPins pins={[pin]} />);
      const before = { ...mockMarkerMounts };

      rerender(<MapPins pins={[{ ...pin, PinIconUrl: NEXT_PIN_URL, IconStyle: 'onscene' }]} />);

      expect(getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: NEXT_PIN_URL });
      expect(mockMarkerMounts).toEqual(before);
      unmount();
    });

    it('goes back to the bundled pin when the status no longer has a styled pin', () => {
      const pin = makeUnitPin({ PinIconUrl: PIN_URL, IconStyle: 'responding' });
      const { queryByTestId, UNSAFE_getByType, rerender, unmount } = render(<MapPins pins={[pin]} />);

      rerender(<MapPins pins={[{ ...pin, PinIconUrl: null, IconStyle: null }]} />);

      expect(queryByTestId('pin-styled-icon', hidden)).toBeNull();
      expect(UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.engine_responding.uri);
      unmount();
    });

    it('tries the new status pin after the previous one failed to load', () => {
      const pin = makeUnitPin({ PinIconUrl: PIN_URL });
      const { getByTestId, queryByTestId, rerender, unmount } = render(<MapPins pins={[pin]} />);

      act(() => {
        fireEvent(getByTestId('pin-styled-icon', hidden), 'error', { error: 'boom' });
      });
      expect(queryByTestId('pin-styled-icon', hidden)).toBeNull();

      rerender(<MapPins pins={[{ ...pin, PinIconUrl: NEXT_PIN_URL }]} />);

      expect(getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: NEXT_PIN_URL });
      unmount();
    });

    it.each(['', '   ', '/api/v4/TypeIcons/Pins/Engine-responding?v=1', 'javascript:alert(1)', 'ftp://api.example.test/pin.png'])('ignores a PinIconUrl that is not an absolute http(s) URL (%p)', (pinIconUrl) => {
      const { queryByTestId, UNSAFE_getByType, unmount } = render(<MapPins pins={[makeUnitPin({ PinIconUrl: pinIconUrl })]} />);

      expect(queryByTestId('pin-styled-icon', hidden)).toBeNull();
      expect(UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.engine_responding.uri);
      unmount();
    });

    it('draws the bundled pin exactly as before when there is no styled pin (or on older servers)', () => {
      const withNulls = render(<MapPins pins={[makeUnitPin({ PinIconUrl: null, IconStyle: null })]} />);
      const treeWithNulls = JSON.stringify(withNulls.toJSON());
      withNulls.unmount();

      const legacy = render(<MapPins pins={[makeUnitPin()]} />);
      expect(JSON.stringify(legacy.toJSON())).toBe(treeWithNulls);
      legacy.unmount();
    });

    it('does not draw a styled pin for a POI', () => {
      const poiPins = [makePin({ Id: 'poi9', Type: 4, ImagePath: '', PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN', Color: '#2563eb', Title: 'General Hospital', PinIconUrl: PIN_URL })];
      const { queryByTestId, unmount } = render(<MapPins pins={poiPins} />);

      expect(queryByTestId('pin-styled-icon', hidden)).toBeNull();
      unmount();
    });

    // PinMarker's memo compares props shallowly: a re-render that only changes the styled pin must still draw it.
    it('re-renders a memoized PinMarker when only its styled pin changes', () => {
      const onPress = jest.fn();
      const { getByTestId, rerender, unmount } = render(<PinMarker imagePath="engine_responding" pinIconUrl={PIN_URL} title="Engine 1" onPress={onPress} />);
      expect(getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: PIN_URL });

      rerender(<PinMarker imagePath="engine_responding" pinIconUrl={NEXT_PIN_URL} title="Engine 1" onPress={onPress} />);

      expect(getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: NEXT_PIN_URL });
      unmount();
    });
  });

  describe('POI type icons', () => {
    const hidden = { includeHiddenElements: true };
    const ICON_URL = 'https://cdn.example.test/poi-types/3/icon.png';
    const countPaths = (root: { findAll: (predicate: (node: { type: unknown }) => boolean) => unknown[] }) => root.findAll((node) => node.type === 'Path').length;

    it('draws a POI with its uploaded type icon instead of the shape', () => {
      const poiPins = [makePin({ Id: 'poi9', Type: 4, ImagePath: '', PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN', Color: '#2563eb', Title: 'General Hospital', IconUrl: ICON_URL })];
      const { getByTestId, UNSAFE_root, unmount } = render(<MapPins pins={poiPins} />);

      const icon = getByTestId('poi-marker-type-icon', hidden);
      expect(icon.props.source).toEqual({ uri: ICON_URL });
      expect(icon.props.style).toEqual({ width: 36, height: 36 });
      expect(countPaths(UNSAFE_root)).toBe(0);
      unmount();
    });

    it('falls back to the shape and icon when the uploaded icon fails to load', () => {
      const poiPins = [makePin({ Id: 'poi9', Type: 4, ImagePath: '', PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN', Color: '#2563eb', Title: 'General Hospital', IconUrl: ICON_URL })];
      const { getByTestId, queryByTestId, UNSAFE_root, unmount } = render(<MapPins pins={poiPins} />);

      act(() => {
        fireEvent(getByTestId('poi-marker-type-icon', hidden), 'error', { error: 'boom' });
      });

      expect(queryByTestId('poi-marker-type-icon', hidden)).toBeNull();
      expect(countPaths(UNSAFE_root)).toBeGreaterThan(0);
      unmount();
    });

    it('draws the shape and icon for a POI without an uploaded icon (older servers)', () => {
      const poiPins = [makePin({ Id: 'poi9', Type: 4, ImagePath: '', PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN', Color: '#2563eb', Title: 'General Hospital' })];
      const { queryByTestId, UNSAFE_root, unmount } = render(<MapPins pins={poiPins} />);

      expect(queryByTestId('poi-marker-type-icon', hidden)).toBeNull();
      expect(countPaths(UNSAFE_root)).toBeGreaterThan(0);
      unmount();
    });
  });
});
