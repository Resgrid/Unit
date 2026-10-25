// The home map screen (src/app/(app)/index.tsx) and its map legend control. The legend sheet itself is covered by
// map-legend-sheet.test.tsx; here it is a stand-in that shows what the screen hands it.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import Map from '@/app/(app)/index';

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: unknown) => Component),
  cssInterop: jest.fn((Component: unknown) => Component),
  useColorScheme: jest.fn(() => ({ colorScheme: 'light', setColorScheme: jest.fn(), toggleColorScheme: jest.fn() })),
  __esModule: true,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/hooks/use-app-lifecycle', () => ({
  useAppLifecycle: () => ({ isActive: true, appState: 'active', isBackground: false, lastActiveTimestamp: 0 }),
}));

jest.mock('@/stores/app/location-store', () => {
  const state = { latitude: 40.7128, longitude: -74.006, heading: 0, accuracy: 10, speed: 0, isMapLocked: false };
  const useLocationStore = Object.assign((selector?: (s: typeof state) => unknown) => (typeof selector === 'function' ? selector(state) : state), { getState: () => state });
  return { useLocationStore };
});

jest.mock('@/services/location', () => ({
  locationService: {
    startLocationUpdates: jest.fn(() => Promise.resolve()),
    stopLocationUpdates: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/hooks/use-map-signalr-updates', () => ({
  useMapSignalRUpdates: jest.fn(() => ({ requestRefresh: jest.fn() })),
}));

jest.mock('@/hooks/use-map-live-locations', () => ({
  useMapLiveLocations: jest.fn(),
  applyLiveLocationsSince: jest.fn((pins: unknown) => pins),
}));

const mockGetMapDataAndMarkers = jest.fn();
const mockGetMapIconLegend = jest.fn();

jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: (...args: unknown[]) => mockGetMapDataAndMarkers(...args),
  getMapIconLegend: (...args: unknown[]) => mockGetMapIconLegend(...args),
}));

jest.mock('@/api/config/terminology', () => ({
  getTerminology: jest.fn(),
}));

jest.mock('@rnmapbox/maps', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  const MapView = ({ children, onDidFinishLoadingMap, ...props }: { children: React.ReactNode; onDidFinishLoadingMap?: () => void }) => {
    ReactActual.useEffect(() => {
      onDidFinishLoadingMap?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return ReactActual.createElement(View, props, children);
  };

  const Camera = ReactActual.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    ReactActual.useImperativeHandle(ref, () => ({ setCamera: jest.fn() }), []);
    return null;
  });

  return {
    setAccessToken: jest.fn(),
    MapView,
    Camera,
    PointAnnotation: 'PointAnnotation',
    MarkerView: 'MarkerView',
    ShapeSource: 'ShapeSource',
    SymbolLayer: 'SymbolLayer',
    CircleLayer: 'CircleLayer',
    LineLayer: 'LineLayer',
    FillLayer: 'FillLayer',
    Images: 'Images',
    StyleURL: { Street: 'mapbox://styles/mapbox/streets-v11', Dark: 'mapbox://styles/mapbox/dark-v10', Light: 'mapbox://styles/mapbox/light-v10' },
    UserTrackingMode: { Follow: 'follow', FollowWithHeading: 'followWithHeading' },
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = jest.requireActual('react');
    ReactActual.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/stores/toast/store', () => {
  const state = { showToast: jest.fn() };
  return { useToastStore: Object.assign((selector?: (s: typeof state) => unknown) => (typeof selector === 'function' ? selector(state) : state), { getState: () => state }) };
});

jest.mock('@/stores/app/core-store', () => {
  const state = { setActiveCall: jest.fn(), isInitialized: true, activeUnitId: null, activeCallId: null, config: null };
  return { useCoreStore: Object.assign((selector?: (s: typeof state) => unknown) => (typeof selector === 'function' ? selector(state) : state), { getState: () => state }) };
});

jest.mock('@/components/maps/map-pins', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/maps/pin-detail-modal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/maps/map-legend-sheet', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    MapLegendSheet: ({ isOpen, onClose, showHydrants }: { isOpen: boolean; onClose: () => void; showHydrants?: boolean }) =>
      isOpen ? (
        <View testID="map-legend-sheet-stub">
          <Text>{showHydrants ? 'hydrants shown' : 'hydrants hidden'}</Text>
          <Pressable testID="map-legend-sheet-stub-close" onPress={onClose} />
        </View>
      ) : null,
  };
});

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackEvent: jest.fn() }),
}));

jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

const pin = (overrides: Record<string, unknown>) => ({ Id: 'u1', Title: 'Engine 1', Latitude: 40.7, Longitude: -74, ImagePath: 'Engine_Available', Type: 1, ...overrides });

describe('Map screen legend control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMapDataAndMarkers.mockResolvedValue({ Data: { MapMakerInfos: [pin({})] } });
  });

  it('shows a labelled legend button over the map', async () => {
    const { unmount } = render(<Map />);
    await waitFor(() => expect(mockGetMapDataAndMarkers).toHaveBeenCalled());

    const button = screen.getByTestId('map-legend-button');
    expect(button.props.accessibilityLabel).toBe('map.legend.button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(screen.getByLabelText('map.legend.button')).toBeTruthy();
    // Closed until asked for, and not fetched with the map.
    expect(screen.queryByTestId('map-legend-sheet-stub')).toBeNull();
    expect(mockGetMapIconLegend).not.toHaveBeenCalled();
    unmount();
  });

  it('opens the legend sheet from the button and closes it again', async () => {
    const { unmount } = render(<Map />);
    await waitFor(() => expect(mockGetMapDataAndMarkers).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('map-legend-button'));
    expect(screen.getByTestId('map-legend-sheet-stub')).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-legend-sheet-stub-close'));
    expect(screen.queryByTestId('map-legend-sheet-stub')).toBeNull();

    // And again: the sheet opens as often as it is asked for.
    fireEvent.press(screen.getByTestId('map-legend-button'));
    expect(screen.getByTestId('map-legend-sheet-stub')).toBeTruthy();
    unmount();
  });

  it('tells the legend to show hydrants only while the map has hydrant pins', async () => {
    const view = render(<Map />);
    await waitFor(() => expect(mockGetMapDataAndMarkers).toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('map-legend-button'));
    expect(screen.getByText('hydrants hidden')).toBeTruthy();
    view.unmount();

    mockGetMapDataAndMarkers.mockResolvedValue({ Data: { MapMakerInfos: [pin({}), pin({ Id: 'hydrant-4', Title: 'Hydrant 12', ImagePath: 'hydrant', Type: 5 })] } });
    const utils = render(<Map />);
    fireEvent.press(screen.getByTestId('map-legend-button'));
    expect(await screen.findByText('hydrants shown')).toBeTruthy();
    utils.unmount();
  });
});
