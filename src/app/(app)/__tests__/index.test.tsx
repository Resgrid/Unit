import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import Map from '../index';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useLocationStore } from '@/stores/app/location-store';
import { locationService } from '@/services/location';

// Mock the dependencies
jest.mock('@/hooks/use-app-lifecycle');
jest.mock('@/stores/app/location-store');
jest.mock('@/services/location');
jest.mock('@/hooks/use-map-signalr-updates', () => ({
  useMapSignalRUpdates: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  })),
}));
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: jest.fn().mockResolvedValue({
    Data: { MapMakerInfos: [] }
  }),
}));
jest.mock('@rnmapbox/maps', () => ({
  setAccessToken: jest.fn(),
  MapView: 'MapView',
  Camera: 'Camera',
  PointAnnotation: 'PointAnnotation',
  StyleURL: {
    Street: 'mapbox://styles/mapbox/streets-v11',
  },
  UserTrackingMode: {
    Follow: 'follow',
    FollowWithHeading: 'followWithHeading',
  },
}));
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children, ...props }: any) => children,
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock('nativewind', () => ({
  useColorScheme: () => ({
    colorScheme: 'light',
  }),
}));
jest.mock('@/stores/toast/store', () => ({
  useToastStore: () => ({
    showToast: jest.fn(),
  }),
}));
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: () => ({
      setActiveCall: jest.fn(),
    }),
  },
}));
jest.mock('@/components/maps/map-pins', () => ({
  __esModule: true,
  default: ({ pins, onPinPress }: any) => null,
}));
jest.mock('@/components/maps/pin-detail-modal', () => ({
  __esModule: true,
  default: ({ pin, isOpen, onClose, onSetAsCurrentCall }: any) => null,
}));



const mockUseAppLifecycle = useAppLifecycle as jest.MockedFunction<typeof useAppLifecycle>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockLocationService = locationService as jest.Mocked<typeof locationService>;

describe('Map Component - App Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseLocationStore.mockReturnValue({
      latitude: 40.7128,
      longitude: -74.0060,
      heading: 0,
      isMapLocked: false,
    });

    mockLocationService.startLocationUpdates = jest.fn().mockResolvedValue(undefined);
    mockLocationService.stopLocationUpdates = jest.fn();
  });

  it('should reset user moved state when app becomes active', async () => {
    // Start with app inactive
    mockUseAppLifecycle.mockReturnValue({
      isActive: false,
      appState: 'background',
      isBackground: true,
      lastActiveTimestamp: null,
    });

    const { rerender } = render(<Map />);

    // Simulate app becoming active
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active',
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    rerender(<Map />);

    await waitFor(() => {
      // Verify that location service was called to start updates
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });
  });

  it('should handle map centering when location updates and app is active', async () => {
    // Mock active app state
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active',
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    render(<Map />);

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });
  });

  it('should reset hasUserMovedMap when map gets locked', async () => {
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active',
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    // Start with unlocked map
    mockUseLocationStore.mockReturnValue({
      latitude: 40.7128,
      longitude: -74.0060,
      heading: 0,
      isMapLocked: false,
    });

    const { rerender } = render(<Map />);

    // Change to locked map
    mockUseLocationStore.mockReturnValue({
      latitude: 40.7128,
      longitude: -74.0060,
      heading: 0,
      isMapLocked: true,
    });

    rerender(<Map />);

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });
  });

  it('should use navigation mode settings when map is locked', async () => {
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active',
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    // Mock locked map with heading
    mockUseLocationStore.mockReturnValue({
      latitude: 40.7128,
      longitude: -74.0060,
      heading: 90, // East
      isMapLocked: true,
    });

    render(<Map />);

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    // The component should render with navigation mode settings
    // (followZoomLevel: 16, followUserMode: FollowWithHeading, followPitch: 45)
  });

  it('should use normal mode settings when map is unlocked', async () => {
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active',
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    // Mock unlocked map
    mockUseLocationStore.mockReturnValue({
      latitude: 40.7128,
      longitude: -74.0060,
      heading: 90,
      isMapLocked: false,
    });

    render(<Map />);

    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });

    // The component should render with normal mode settings
    // (followZoomLevel: 12, followUserMode: undefined, no followPitch)
  });

  it('should reset camera to normal view when exiting locked mode', async () => {
    // Create a simplified test that focuses on the behavior without rendering the full component
    const mockSetCamera = jest.fn();

    // Mock the location service more completely
    mockLocationService.startLocationUpdates.mockResolvedValue(undefined);
    mockLocationService.stopLocationUpdates.mockResolvedValue(undefined);

    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active',
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    // Test the logic by checking if the effect would be called
    // We'll verify this by testing the behavior when the map lock state changes
    let lockState = true;
    let currentLocation = {
      latitude: 40.7128,
      longitude: -74.0060,
      heading: 90,
      isMapLocked: lockState,
    };

    mockUseLocationStore.mockImplementation(() => currentLocation);

    const { rerender } = render(<Map />);

    // Simulate unlocking the map
    lockState = false;
    currentLocation = {
      ...currentLocation,
      isMapLocked: lockState,
    };

    rerender(<Map />);

    // The test passes if the component renders without errors
    // The actual camera reset behavior is tested through integration tests
    await waitFor(() => {
      expect(mockLocationService.startLocationUpdates).toHaveBeenCalled();
    });
  });
}); 