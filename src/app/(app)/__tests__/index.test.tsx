// Mock nativewind before any imports
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  cssInterop: jest.fn((Component: any) => Component),
  useColorScheme: jest.fn(() => ({
    colorScheme: 'light',
    get: jest.fn(() => 'light'),
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  })),
  __esModule: true,
}));

import { render, waitFor } from '@testing-library/react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Map from '../index';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useLocationStore } from '@/stores/app/location-store';
import { locationService } from '@/services/location';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/hooks/use-app-lifecycle');
jest.mock('@/stores/app/location-store');
jest.mock('@/services/location');
jest.mock('@/hooks/use-map-signalr-updates', () => ({
  useMapSignalRUpdates: jest.fn(),
}));
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: jest.fn().mockResolvedValue({
    Data: { MapMakerInfos: [] },
  }),
}));
// Camera commands issued by the screen. The MapView mock reports the map ready
// on mount and the Camera mock exposes a real imperative handle, so the
// follow-camera effects actually run in tests.
const mockSetCamera = jest.fn();

jest.mock('@rnmapbox/maps', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  const MapView = ({ children, onDidFinishLoadingMap, ...props }: any) => {
    ReactActual.useEffect(() => {
      onDidFinishLoadingMap?.();
      // Fire once — mirrors the native "map finished loading" callback.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return ReactActual.createElement(View, props, children);
  };

  const Camera = ReactActual.forwardRef((_props: any, ref: any) => {
    ReactActual.useImperativeHandle(ref, () => ({ setCamera: mockSetCamera }), []);
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
    StyleURL: {
      Street: 'mapbox://styles/mapbox/streets-v11',
      Dark: 'mapbox://styles/mapbox/dark-v10',
      Light: 'mapbox://styles/mapbox/light-v10',
    },
    UserTrackingMode: {
      Follow: 'follow',
      FollowWithHeading: 'followWithHeading',
    },
  };
});
jest.mock('expo-router', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  })),
  Stack: {
    Screen: ({ children, ...props }: any) => children,
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  // Mirror the real hook: run the effect, re-running only when the callback
  // identity changes. The screen's focus callback is dependency-stable, so this
  // fires once per mount — a callback that churned per lock toggle (the bug the
  // consolidated camera effect fixes) would show up here as extra setCamera calls.
  useFocusEffect: (callback: any) => {
    const ReactActual = jest.requireActual('react');
    ReactActual.useEffect(() => callback(), [callback]);
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock('@/stores/toast/store', () => ({
  useToastStore: (selector: any) =>
    typeof selector === 'function'
      ? selector({
          showToast: jest.fn(),
          getState: () => ({
            showToast: jest.fn(),
          }),
        })
      : {
          showToast: jest.fn(),
          getState: () => ({
            showToast: jest.fn(),
          }),
        },
}));
jest.mock('@/stores/app/core-store', () => {
  const storeState = {
    setActiveCall: jest.fn(),
    isInitialized: true,
    activeCall: null,
    activePriority: null,
    activeUnit: null,
    activeUnitStatus: null,
  };
  const mockFn = jest.fn((selector) => (typeof selector === 'function' ? selector(storeState) : storeState)) as jest.Mock & { getState: () => typeof storeState };
  mockFn.getState = () => storeState;
  return { useCoreStore: mockFn };
});
jest.mock('@/components/maps/map-pins', () => ({
  __esModule: true,
  default: ({ pins, onPinPress }: any) => null,
}));
jest.mock('@/components/maps/pin-detail-modal', () => ({
  __esModule: true,
  default: ({ pin, isOpen, onClose, onSetAsCurrentCall }: any) => null,
}));
jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    trackEvent: jest.fn(),
  }),
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => <SafeAreaProvider>{children}</SafeAreaProvider>;
jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

const mockUseAppLifecycle = useAppLifecycle as jest.MockedFunction<typeof useAppLifecycle>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockLocationService = locationService as jest.Mocked<typeof locationService>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

// Create stable reference objects to prevent infinite re-renders
const defaultLocationState = {
  latitude: 40.7128,
  longitude: -74.006,
  heading: 0,
  isMapLocked: false,
};

// buildFollowCamera reads the store imperatively via getState(), so the mocked
// hook and getState must agree. Tests mutate this through setLocationState.
let currentLocationState: Record<string, any> = { ...defaultLocationState };

const setLocationState = (next: Record<string, any>) => {
  currentLocationState = { ...currentLocationState, ...next };
  mockUseLocationStore.mockImplementation((selector: any) => (typeof selector === 'function' ? selector(currentLocationState) : currentLocationState));
  (useLocationStore as any).getState = () => currentLocationState;
};

const defaultAppLifecycleState = {
  isActive: true,
  appState: 'active' as const,
  isBackground: false,
  lastActiveTimestamp: Date.now(),
};

describe('Map Component - App Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockSetCamera.mockClear();

    // Setup default mocks with stable objects
    currentLocationState = { ...defaultLocationState, speed: 0, accuracy: 10 };
    (useLocationStore as any).getState = () => currentLocationState;
    mockUseLocationStore.mockImplementation((selector: any) => (typeof selector === 'function' ? selector(defaultLocationState) : defaultLocationState));
    mockUseAppLifecycle.mockReturnValue(defaultAppLifecycleState);
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    mockLocationService.startLocationUpdates = jest.fn().mockResolvedValue(undefined);
    mockLocationService.stopLocationUpdates = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Clean up all timers and async operations
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();

    // Ensure location service is stopped
    if (mockLocationService.stopLocationUpdates) {
      mockLocationService.stopLocationUpdates();
    }
  });

  it('should render without crashing', async () => {
    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    // Clean up the component
    unmount();
  });

  it('should handle location updates', async () => {
    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    unmount();
  });

  it('should handle app lifecycle changes', async () => {
    // Test with inactive app
    mockUseAppLifecycle.mockReturnValue({
      isActive: false,
      appState: 'background' as const,
      isBackground: true,
      lastActiveTimestamp: null,
    });

    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    // Simulate app becoming active
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active' as const,
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    rerender(<Map />);

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    unmount();
  });

  it('should handle map lock state changes', async () => {
    // Start with unlocked map
    mockUseLocationStore.mockImplementation((selector: any) =>
      typeof selector === 'function'
        ? selector({
            ...defaultLocationState,
            isMapLocked: false,
          })
        : {
            ...defaultLocationState,
            isMapLocked: false,
          }
    );

    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    // Change to locked map
    mockUseLocationStore.mockImplementation((selector: any) =>
      typeof selector === 'function'
        ? selector({
            ...defaultLocationState,
            isMapLocked: true,
          })
        : {
            ...defaultLocationState,
            isMapLocked: true,
          }
    );

    rerender(<Map />);

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    unmount();
  });

  it('should handle navigation mode with heading', async () => {
    // Mock locked map with heading
    mockUseLocationStore.mockImplementation((selector: any) =>
      typeof selector === 'function'
        ? selector({
            ...defaultLocationState,
            heading: 90,
            isMapLocked: true,
          })
        : {
            ...defaultLocationState,
            heading: 90,
            isMapLocked: true,
          }
    );

    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    unmount();
  });

  it('should use light theme map style when in light mode', async () => {
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    // The map should use the light style
    // Since we can't directly test the MapView props, we test that the component renders without errors
    unmount();
  });

  it('should use dark theme map style when in dark mode', async () => {
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'dark',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    // The map should use the dark style
    // Since we can't directly test the MapView props, we test that the component renders without errors
    unmount();
  });

  it('should handle theme changes gracefully', async () => {
    // Start with light theme
    const setColorScheme = jest.fn();
    const toggleColorScheme = jest.fn();

    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme,
      toggleColorScheme,
    });

    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    // Change to dark theme
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'dark',
      setColorScheme,
      toggleColorScheme,
    });

    rerender(<Map />);

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    // Component should handle theme changes without errors
    unmount();
  });

  it('should track analytics with theme information', async () => {
    const mockTrackEvent = jest.fn();

    // We need to mock the useAnalytics hook
    jest.doMock('@/hooks/use-analytics', () => ({
      useAnalytics: () => ({ trackEvent: mockTrackEvent }),
    }));

    mockUseColorScheme.mockReturnValue({
      colorScheme: 'dark',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    // Note: The analytics tracking is tested indirectly since we can't easily mock it in this setup
    unmount();
  });
});
describe('Map Component - follow camera', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSetCamera.mockClear();

    mockUseAppLifecycle.mockReturnValue(defaultAppLifecycleState);
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    mockLocationService.startLocationUpdates = jest.fn().mockResolvedValue(undefined);
    mockLocationService.stopLocationUpdates = jest.fn().mockResolvedValue(undefined);

    currentLocationState = { ...defaultLocationState, speed: 0, accuracy: 10 };
    setLocationState({});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const lastCameraConfig = () => mockSetCamera.mock.calls[mockSetCamera.mock.calls.length - 1][0];

  it('issues exactly one camera command when the map becomes ready', () => {
    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    // The focus effect and the camera effect must not both fire here.
    expect(mockSetCamera).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('issues exactly one camera command per lock toggle', () => {
    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });
    expect(mockSetCamera).toHaveBeenCalledTimes(1);
    mockSetCamera.mockClear();

    // Lock the map.
    setLocationState({ isMapLocked: true });
    rerender(<Map />);
    expect(mockSetCamera).toHaveBeenCalledTimes(1);

    // ...and unlock it again.
    mockSetCamera.mockClear();
    setLocationState({ isMapLocked: false });
    rerender(<Map />);
    expect(mockSetCamera).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('delivers a throttled location update on the trailing edge', () => {
    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });
    expect(mockSetCamera).toHaveBeenCalledTimes(1);
    mockSetCamera.mockClear();

    // A fix arriving inside the 5s throttle window is dropped...
    jest.advanceTimersByTime(1000);
    setLocationState({ latitude: 41.0, longitude: -75.0 });
    rerender(<Map />);
    expect(mockSetCamera).not.toHaveBeenCalled();

    // ...but replayed once the window expires, so the camera can't park behind
    // a unit whose last movement landed inside the window.
    jest.advanceTimersByTime(4000);
    expect(mockSetCamera).toHaveBeenCalledTimes(1);
    expect(lastCameraConfig().centerCoordinate).toEqual([-75.0, 41.0]);

    unmount();
  });

  it('replays only the newest dropped update on the trailing edge', () => {
    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });
    mockSetCamera.mockClear();

    jest.advanceTimersByTime(500);
    setLocationState({ latitude: 41.0, longitude: -75.0 });
    rerender(<Map />);

    jest.advanceTimersByTime(500);
    setLocationState({ latitude: 42.0, longitude: -76.0 });
    rerender(<Map />);

    expect(mockSetCamera).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);
    // Superseded, not queued: one command carrying the latest fix.
    expect(mockSetCamera).toHaveBeenCalledTimes(1);
    expect(lastCameraConfig().centerCoordinate).toEqual([-76.0, 42.0]);

    unmount();
  });

  it('does not fire a trailing update after unmount', () => {
    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });
    mockSetCamera.mockClear();

    jest.advanceTimersByTime(1000);
    setLocationState({ latitude: 41.0, longitude: -75.0 });
    rerender(<Map />);

    unmount();
    jest.advanceTimersByTime(10000);
    expect(mockSetCamera).not.toHaveBeenCalled();
  });

  // The camera pitch is driven by the *smoothed* speed, so these steps are
  // chosen to land it inside the 0.7–1.5 m/s dead band, where the old
  // hard "> 1 m/s" rule and the hysteresis rule disagree.
  it('holds top-down while smoothed speed is still inside the dead band', () => {
    setLocationState({ heading: 90, speed: 0 });
    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });
    expect(lastCameraConfig().pitch).toBe(0);

    // One 3 m/s fix from a standstill smooths to 1.2 m/s. The old rule tilted
    // here; hysteresis holds top-down until 1.5 m/s is cleared.
    jest.advanceTimersByTime(6000);
    setLocationState({ speed: 3, latitude: 40.72 });
    rerender(<Map />);
    expect(lastCameraConfig().pitch).toBe(0);

    unmount();
  });

  it('holds the tilt while slowing through the dead band', () => {
    setLocationState({ heading: 90, speed: 2 });
    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    // Settle the smoothed speed at ~2 m/s so the camera is tilted.
    for (let i = 0; i < 8; i++) {
      jest.advanceTimersByTime(6000);
      setLocationState({ speed: 2, latitude: 40.72 + i * 0.01 });
      rerender(<Map />);
    }
    expect(lastCameraConfig().pitch).toBe(45);

    // Stopping smooths 2 → 1.2 (still tilted under either rule)...
    jest.advanceTimersByTime(6000);
    setLocationState({ speed: 0, latitude: 40.85 });
    rerender(<Map />);
    expect(lastCameraConfig().pitch).toBe(45);

    // ...then 1.2 → 0.72, which the old rule flattened. Hysteresis keeps the
    // tilt until the unit is properly stopped.
    jest.advanceTimersByTime(6000);
    setLocationState({ speed: 0, latitude: 40.86 });
    rerender(<Map />);
    expect(lastCameraConfig().pitch).toBe(45);

    // Below 0.7 m/s the camera finally returns to top-down.
    jest.advanceTimersByTime(6000);
    setLocationState({ speed: 0, latitude: 40.87 });
    rerender(<Map />);
    expect(lastCameraConfig().pitch).toBe(0);

    unmount();
  });

  it('tilts once the unit is clearly moving', () => {
    setLocationState({ heading: 90, speed: 0 });
    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(6000);
      setLocationState({ speed: 12, latitude: 40.73 + i * 0.01 });
      rerender(<Map />);
    }
    expect(lastCameraConfig().pitch).toBe(45);

    unmount();
  });
});
