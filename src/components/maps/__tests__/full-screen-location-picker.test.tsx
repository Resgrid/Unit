/**
 * Renders the REAL FullScreenLocationPicker.
 *
 * The previous suite replaced the module with `() => null` and then asserted that the
 * replacement was defined, so none of the 284 lines under test ever executed. Only the
 * component's dependencies are mocked here (Mapbox, expo-location, the department map
 * centre, i18n and the icon set) — the picker itself is the real thing.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator } from 'react-native';

// ── Native / module mocks (must precede the subject import) ──────────────────

jest.mock('@/lib/env', () => ({
  Env: {
    UNIT_MAPBOX_PUBKEY: 'test-mapbox-key',
  },
}));

const mockDepartmentCenter = { latitude: 39.14086268299356, longitude: -119.7583809782715, zoomLevel: 9 };
jest.mock('@/lib/map-center', () => ({
  getDepartmentMapCenter: jest.fn(() => mockDepartmentCenter),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

interface MockMapProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

// The camera is driven imperatively by the component, so the mock has to expose a ref
// with setCamera — that is the only way the picker can move the map.
const mockSetCamera = jest.fn();

jest.mock('@/components/maps/mapbox', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MapView = React.forwardRef(({ children, ...props }: MockMapProps, ref: unknown) => (
    <View testID="map-view" ref={ref} {...props}>
      {children}
    </View>
  ));
  MapView.displayName = 'MockMapView';

  const Camera = React.forwardRef((props: MockMapProps, ref: any) => {
    React.useImperativeHandle(ref, () => ({ setCamera: mockSetCamera }));
    return <View testID="map-camera" {...props} />;
  });
  Camera.displayName = 'MockCamera';

  const PointAnnotation = ({ children, ...props }: MockMapProps) => (
    <View testID="map-point-annotation" {...props}>
      {children}
    </View>
  );

  return {
    __esModule: true,
    default: {
      MapView,
      Camera,
      PointAnnotation,
      setAccessToken: jest.fn(),
      StyleURL: { Dark: 'dark', Street: 'street' },
    },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return {
    LocateIcon: (props: Record<string, unknown>) => <View testID="locate-icon" {...props} />,
    MapPinIcon: (props: Record<string, unknown>) => <View testID="map-pin-icon" {...props} />,
    XIcon: (props: Record<string, unknown>) => <View testID="close-icon" {...props} />,
  };
});

import * as Location from 'expo-location';

import { logger } from '@/lib/logging';

import FullScreenLocationPicker from '../full-screen-location-picker';

const mockRequestPermissions = Location.requestForegroundPermissionsAsync as unknown as jest.Mock;
const mockGetCurrentPosition = Location.getCurrentPositionAsync as unknown as jest.Mock;
const mockReverseGeocode = Location.reverseGeocodeAsync as unknown as jest.Mock;
const mockLoggerWarn = logger.warn as unknown as jest.Mock;
const mockLoggerError = logger.error as unknown as jest.Mock;

/** Accessible names for the icon-only controls (the i18n mock echoes the key). */
const CLOSE_LABEL = 'common.close';
const MY_LOCATION_LABEL = 'common.get_my_location';

/** Mirrors LOCATION_TIMEOUT in the component. */
const LOCATION_TIMEOUT_MS = 10000;

let setTimeoutSpy: jest.SpyInstance;
let clearTimeoutSpy: jest.SpyInstance;

/**
 * Counts the component's own still-armed LOCATION_TIMEOUT timers.
 *
 * `jest.getTimerCount()` is unusable here: it also counts React Native internals, so it
 * reports a non-zero baseline that has nothing to do with this component. Matching on the
 * 10s delay isolates the timer under test and keeps the assertion honest.
 */
const armedLocationTimers = (): unknown[] => {
  const armed = setTimeoutSpy.mock.calls.map((call, index) => ({ delay: call[1], id: setTimeoutSpy.mock.results[index]?.value })).filter((entry) => entry.delay === LOCATION_TIMEOUT_MS);
  const cleared = new Set(clearTimeoutSpy.mock.calls.map((call) => call[0]));
  return armed.filter((entry) => !cleared.has(entry.id)).map((entry) => entry.id);
};

/** A GeoJSON Point feature shaped the way Mapbox hands one to onPress. */
const pointFeature = (longitude: number, latitude: number) =>
  ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
  }) as unknown as GeoJSON.Feature;

const INITIAL_LOCATION = { latitude: 40.7128, longitude: -74.006 };

describe('FullScreenLocationPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fake timers let the 10s LOCATION_TIMEOUT be exercised directly, and make the pending
    // timer set an observable — which is how the leak tests below assert cleanup.
    jest.useFakeTimers();
    // Installed after useFakeTimers so the spies wrap the fake implementations.
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetCurrentPosition.mockResolvedValue({ coords: { latitude: 51.5074, longitude: -0.1278 } });
    mockReverseGeocode.mockResolvedValue([{ street: '123 Main St', name: '123 Main St', city: 'Springfield', region: 'IL', country: 'USA', postalCode: '62704' }]);
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('initial location handling', () => {
    it('opens on the supplied initial location at street zoom and skips the device fix', async () => {
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 40.7128, longitude: -74.006 }));

      expect(screen.getByTestId('map-camera').props.defaultSettings).toEqual({
        centerCoordinate: [-74.006, 40.7128],
        zoomLevel: 15,
      });
      expect(screen.getByTestId('map-point-annotation').props.coordinate).toEqual([-74.006, 40.7128]);
      expect(screen.getByText('40.712800, -74.006000')).toBeTruthy();
      // A known starting point means no device lookup and no "tap the map" nag.
      expect(mockRequestPermissions).not.toHaveBeenCalled();
      expect(screen.queryByText('common.tap_map_to_select')).toBeNull();

      unmount();
    });

    it('flies the camera to the initial location imperatively', async () => {
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() =>
        expect(mockSetCamera).toHaveBeenCalledWith({
          centerCoordinate: [-74.006, 40.7128],
          zoomLevel: 15,
          animationDuration: 1000,
        })
      );

      unmount();
    });

    it('never passes centerCoordinate as a Camera prop', async () => {
      // Regression guard: driving the camera by prop as well as imperatively made every
      // map tap re-fly the camera to the tapped point, fighting the pan gesture.
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalled());

      expect(screen.getByTestId('map-camera').props.centerCoordinate).toBeUndefined();

      unmount();
    });

    it('falls back to the department map centre at overview zoom when no initial location is given', async () => {
      // Never resolving: keeps the picker in its pre-fix state so the fallback is observable.
      mockGetCurrentPosition.mockImplementation(() => new Promise(() => {}));

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockRequestPermissions).toHaveBeenCalled());

      expect(screen.getByTestId('map-camera').props.defaultSettings).toEqual({
        centerCoordinate: [mockDepartmentCenter.longitude, mockDepartmentCenter.latitude],
        zoomLevel: 4,
      });
      expect(screen.getByText('39.140863, -119.758381')).toBeTruthy();
      expect(screen.getByText('common.tap_map_to_select')).toBeTruthy();

      unmount();
    });

    it('adopts the device fix when no initial location is given', async () => {
      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      expect(await screen.findByText('51.507400, -0.127800')).toBeTruthy();
      expect(mockGetCurrentPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
      expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 51.5074, longitude: -0.1278 });
      expect(mockSetCamera).toHaveBeenCalledWith({ centerCoordinate: [-0.1278, 51.5074], zoomLevel: 15, animationDuration: 1000 });
      // Hint clears once a real position is known.
      expect(screen.queryByText('common.tap_map_to_select')).toBeNull();

      unmount();
    });

    it('keeps the department centre when the location permission is denied', async () => {
      mockRequestPermissions.mockResolvedValue({ status: 'denied' });

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      // Wait for isLocating to fall back to false: that only happens once getUserLocation
      // has run to completion, so a bare "not called" check cannot pass by racing ahead.
      await waitFor(() => expect(screen.getByTestId('locate-icon')).toBeTruthy());
      expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
      expect(screen.getByText('39.140863, -119.758381')).toBeTruthy();
      expect(screen.getByText('common.tap_map_to_select')).toBeTruthy();

      unmount();
    });

    it('logs a denied permission at warn, not error', async () => {
      // A user declining the prompt is an expected outcome, not a fault to page Sentry with.
      mockRequestPermissions.mockResolvedValue({ status: 'denied' });

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockLoggerWarn).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Location permission not granted') })));
      expect(mockLoggerError).not.toHaveBeenCalled();

      unmount();
    });

    it('gives up on a device fix that never returns once the 10s timeout elapses', async () => {
      mockGetCurrentPosition.mockImplementation(() => new Promise(() => {}));

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockGetCurrentPosition).toHaveBeenCalled());
      // Spinner is up while the fix is outstanding.
      expect(screen.queryByTestId('locate-icon')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      // A slow fix is transient, so it logs at warn rather than as a Sentry error.
      expect(mockLoggerWarn).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Timed out getting the device location') }));
      expect(mockLoggerError).not.toHaveBeenCalled();
      // Button becomes usable again and the map stays on the department centre.
      expect(screen.getByTestId('locate-icon')).toBeTruthy();
      expect(screen.getByText('39.140863, -119.758381')).toBeTruthy();

      unmount();
    });

    it('keeps the department centre when the device fix fails', async () => {
      mockGetCurrentPosition.mockRejectedValue(new Error('no gps'));

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      // An unexpected platform failure is a genuine error and must reach Sentry.
      await waitFor(() => expect(mockLoggerError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Failed to get the device location') })));

      expect(screen.getByText('39.140863, -119.758381')).toBeTruthy();
      // The spinner must stop even on the failure path, or the button stays dead.
      expect(screen.getByTestId('locate-icon')).toBeTruthy();

      unmount();
    });
  });

  describe('location timeout cleanup', () => {
    // The 10s timer holds a closure over the component. Every path that leaves
    // getUserLocation must disarm it, or failed attempts pile up live timers.

    it('leaves no pending timer when the device fix rejects', async () => {
      mockGetCurrentPosition.mockRejectedValue(new Error('no gps'));

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockLoggerError).toHaveBeenCalled());

      // The timer was armed before getCurrentPositionAsync rejected, so this is not vacuous.
      expect(setTimeoutSpy.mock.calls.some((call) => call[1] === LOCATION_TIMEOUT_MS)).toBe(true);
      expect(armedLocationTimers()).toEqual([]);

      unmount();
    });

    it('does not stack timers across repeated failed attempts', async () => {
      mockGetCurrentPosition.mockRejectedValue(new Error('no gps'));

      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalled());

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        fireEvent.press(screen.getByLabelText(MY_LOCATION_LABEL));
        await waitFor(() => expect(mockGetCurrentPosition).toHaveBeenCalledTimes(attempt));
        await act(async () => {});
      }

      // Three failed attempts armed three timers; none may still be live.
      expect(setTimeoutSpy.mock.calls.filter((call) => call[1] === LOCATION_TIMEOUT_MS)).toHaveLength(3);
      expect(armedLocationTimers()).toEqual([]);

      unmount();
    });

    it('clears a still-armed timer when the picker unmounts mid-lookup', async () => {
      // Never resolves, so the timer is genuinely outstanding at unmount.
      mockGetCurrentPosition.mockImplementation(() => new Promise(() => {}));

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockGetCurrentPosition).toHaveBeenCalled());
      // Guard the guard: if nothing were armed, the assertion after unmount would be vacuous.
      expect(armedLocationTimers()).toHaveLength(1);

      unmount();

      expect(armedLocationTimers()).toEqual([]);
    });
  });

  describe('map interaction', () => {
    it('moves the selected coordinate and marker to the tapped point', async () => {
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 40.7128, longitude: -74.006 }));

      fireEvent(screen.getByTestId('map-view'), 'press', pointFeature(-122.4194, 37.7749));

      expect(await screen.findByText('37.774900, -122.419400')).toBeTruthy();
      expect(screen.getByTestId('map-point-annotation').props.coordinate).toEqual([-122.4194, 37.7749]);
      expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 37.7749, longitude: -122.4194 });

      unmount();
    });

    it('does not re-fly the camera on a map tap', async () => {
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockSetCamera).toHaveBeenCalledTimes(1));

      fireEvent(screen.getByTestId('map-view'), 'press', pointFeature(-122.4194, 37.7749));
      await screen.findByText('37.774900, -122.419400');

      expect(mockSetCamera).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('clears the "tap the map" hint once the user has tapped', async () => {
      mockGetCurrentPosition.mockImplementation(() => new Promise(() => {}));

      const { unmount } = render(<FullScreenLocationPicker onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(screen.getByText('common.tap_map_to_select')).toBeTruthy());

      fireEvent(screen.getByTestId('map-view'), 'press', pointFeature(10.5, 20.25));

      expect(await screen.findByText('20.250000, 10.500000')).toBeTruthy();
      expect(screen.queryByText('common.tap_map_to_select')).toBeNull();

      unmount();
    });

    it('ignores a press whose geometry carries no coordinates', async () => {
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalledTimes(1));

      fireEvent(screen.getByTestId('map-view'), 'press', {
        type: 'Feature',
        properties: {},
        geometry: { type: 'GeometryCollection', geometries: [] },
      } as unknown as GeoJSON.Feature);

      expect(screen.getByText('40.712800, -74.006000')).toBeTruthy();
      expect(mockReverseGeocode).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  describe('address lookup', () => {
    it('renders the joined address and drops the duplicate name/street part', async () => {
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      expect(await screen.findByText('123 Main St, Springfield, IL, 62704, USA')).toBeTruthy();

      unmount();
    });

    it('keeps a place name that differs from the street', async () => {
      mockReverseGeocode.mockResolvedValue([{ street: '1 Infinite Loop', name: 'Apple Park', city: 'Cupertino', region: 'CA', country: 'USA', postalCode: '95014' }]);

      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      expect(await screen.findByText('1 Infinite Loop, Apple Park, Cupertino, CA, 95014, USA')).toBeTruthy();

      unmount();
    });

    it('shows the loading placeholder while the lookup is in flight', async () => {
      let resolveGeocode: (value: unknown) => void = () => {};
      mockReverseGeocode.mockImplementation(() => new Promise((resolve) => (resolveGeocode = resolve)));

      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      expect(await screen.findByText('common.loading_address')).toBeTruthy();

      resolveGeocode([{ city: 'Springfield' }]);

      expect(await screen.findByText('Springfield')).toBeTruthy();
      expect(screen.queryByText('common.loading_address')).toBeNull();

      unmount();
    });

    it('reports no address when the lookup comes back empty', async () => {
      mockReverseGeocode.mockResolvedValue([]);

      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      expect(await screen.findByText('common.no_address_found')).toBeTruthy();

      unmount();
    });

    it('reports no address when the lookup throws', async () => {
      mockReverseGeocode.mockRejectedValue(new Error('offline'));

      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      expect(await screen.findByText('common.no_address_found')).toBeTruthy();
      // Offline/geocoder-down is transient and the UI degrades gracefully, so warn not error.
      expect(mockLoggerWarn).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Reverse geocode failed') }));
      expect(mockLoggerError).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('confirm and cancel', () => {
    it('hands back the tapped coordinate with its resolved address and then closes', async () => {
      const onLocationSelected = jest.fn();
      const onClose = jest.fn();
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={onLocationSelected} onClose={onClose} />);

      await screen.findByText('123 Main St, Springfield, IL, 62704, USA');

      mockReverseGeocode.mockResolvedValue([{ city: 'San Francisco', region: 'CA' }]);
      fireEvent(screen.getByTestId('map-view'), 'press', pointFeature(-122.4194, 37.7749));
      await screen.findByText('San Francisco, CA');

      fireEvent.press(screen.getByText('common.set_location'));

      expect(onLocationSelected).toHaveBeenCalledWith({
        latitude: 37.7749,
        longitude: -122.4194,
        address: 'San Francisco, CA',
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('reports an undefined address when none could be resolved', async () => {
      mockReverseGeocode.mockResolvedValue([]);
      const onLocationSelected = jest.fn();
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={onLocationSelected} onClose={jest.fn()} />);

      await screen.findByText('common.no_address_found');

      fireEvent.press(screen.getByText('common.set_location'));

      expect(onLocationSelected).toHaveBeenCalledWith({ latitude: 40.7128, longitude: -74.006, address: undefined });

      unmount();
    });

    it('closes without selecting anything when the close button is pressed', async () => {
      const onLocationSelected = jest.fn();
      const onClose = jest.fn();
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={onLocationSelected} onClose={onClose} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalled());

      fireEvent.press(screen.getByLabelText(CLOSE_LABEL));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onLocationSelected).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('accessibility', () => {
    it('gives both icon-only controls an accessible name and button role', async () => {
      // Without these, a screen-reader user hears "button" twice with no way to tell the
      // destructive close apart from the harmless re-locate.
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalled());

      for (const label of [CLOSE_LABEL, MY_LOCATION_LABEL]) {
        expect(screen.getByLabelText(label).props.accessibilityRole).toBe('button');
      }

      unmount();
    });
  });

  describe('my-location button', () => {
    it('re-runs the device lookup and recentres on the result', async () => {
      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalled());
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();

      fireEvent.press(screen.getByLabelText(MY_LOCATION_LABEL));

      expect(await screen.findByText('51.507400, -0.127800')).toBeTruthy();
      expect(mockSetCamera).toHaveBeenLastCalledWith({ centerCoordinate: [-0.1278, 51.5074], zoomLevel: 15, animationDuration: 1000 });

      unmount();
    });

    it('swaps the icon for a spinner and blocks re-entry while locating', async () => {
      let resolvePosition: (value: unknown) => void = () => {};
      mockGetCurrentPosition.mockImplementation(() => new Promise((resolve) => (resolvePosition = resolve)));

      const { unmount } = render(<FullScreenLocationPicker initialLocation={INITIAL_LOCATION} onLocationSelected={jest.fn()} onClose={jest.fn()} />);

      await waitFor(() => expect(mockReverseGeocode).toHaveBeenCalled());

      fireEvent.press(screen.getByLabelText(MY_LOCATION_LABEL));
      // requestForegroundPermissionsAsync is reached synchronously, so its call count is a
      // direct, non-racy witness that a lookup was actually started.
      expect(mockRequestPermissions).toHaveBeenCalledTimes(1);

      await waitFor(() => expect(screen.queryByTestId('locate-icon')).toBeNull());
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
      expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);

      // The button keeps its accessible name while the spinner occupies it, so this presses
      // the live control — a press that `disabled` must swallow.
      fireEvent.press(screen.getByLabelText(MY_LOCATION_LABEL));
      expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
      await act(async () => {});
      expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);

      resolvePosition({ coords: { latitude: 51.5074, longitude: -0.1278 } });
      expect(await screen.findByTestId('locate-icon')).toBeTruthy();

      unmount();
    });
  });
});
