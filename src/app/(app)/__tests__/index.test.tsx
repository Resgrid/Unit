import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import Map from '../index';

// Mock expo-router
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Mapbox
jest.mock('@rnmapbox/maps', () => {
  const { View } = require('react-native');
  return {
    setAccessToken: jest.fn(),
    MapView: ({ children, testID, onCameraChanged, ...props }: any) => (
      <View testID={testID} onTouchStart={() => onCameraChanged?.({ properties: { isUserInteraction: true } })} {...props}>
        {children}
      </View>
    ),
    Camera: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    PointAnnotation: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    MarkerView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    StyleURL: {
      Street: 'mapbox://styles/mapbox/streets-v11',
      Satellite: 'mapbox://styles/mapbox/satellite-v9',
    },
    UserTrackingMode: {
      Follow: 'follow',
    },
  };
});

// Mock location service
jest.mock('@/services/location', () => ({
  locationService: {
    startLocationUpdates: jest.fn().mockResolvedValue(true),
    stopLocationUpdates: jest.fn(),
  },
}));

// Mock API
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: jest.fn().mockResolvedValue({
    Data: {
      MapMakerInfos: [
        {
          Id: '1',
          Title: 'Test Call',
          Latitude: 40.7128,
          Longitude: -74.0060,
          ImagePath: 'call',
          Type: 1,
          InfoWindowContent: 'Test call content',
          Color: '#ff0000',
        },
        {
          Id: '2',
          Title: 'Test Unit',
          Latitude: 40.7580,
          Longitude: -73.9855,
          ImagePath: 'truck',
          Type: 2,
          InfoWindowContent: 'Test unit content',
          Color: '#00ff00',
        },
      ],
    },
  }),
}));

// Mock hooks
jest.mock('@/hooks/use-map-signalr-updates', () => ({
  useMapSignalRUpdates: jest.fn(),
}));

// Mock stores
const mockLocationStore = {
  latitude: 40.7128,
  longitude: -74.0060,
  heading: 45,
};

const mockCoreStore = {
  setActiveCall: jest.fn().mockResolvedValue(true),
};

const mockToastStore = {
  showToast: jest.fn(),
};

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockLocationStore);
    }
    return mockLocationStore;
  }),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: jest.fn(() => mockCoreStore),
  },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: {
    getState: jest.fn(() => mockToastStore),
  },
}));

// Mock components
jest.mock('@/components/maps/map-pins', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return function MockMapPins({ pins, onPinPress }: { pins: any[]; onPinPress?: (pin: any) => void }) {
    return (
      <>
        {pins.map((pin) => (
          <TouchableOpacity key={pin.Id} testID={`pin-${pin.Id}`} onPress={() => onPinPress?.(pin)}>
            <Text>{pin.Title}</Text>
          </TouchableOpacity>
        ))}
      </>
    );
  };
});

jest.mock('@/components/maps/pin-detail-modal', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockPinDetailModal({ pin, isOpen, onClose, onSetAsCurrentCall }: any) {
    if (!isOpen || !pin) return null;
    return (
      <View testID="pin-detail-modal">
        <Text testID="pin-title">{pin.Title}</Text>
        <TouchableOpacity testID="close-pin-detail" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="set-as-current-call" onPress={() => onSetAsCurrentCall(pin)}>
          <Text>Set as Current Call</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

describe('Map', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the map component', () => {
    render(<Map />);

    expect(screen.getByTestId('map-container')).toBeTruthy();
  });

  it('should show recenter button when user has moved the map', async () => {
    const { rerender } = render(<Map />);

    // Initially, recenter button should not be visible
    expect(screen.queryByTestId('recenter-button')).toBeFalsy();

    // Simulate user moving the map
    const mapView = screen.getByTestId('map-view');
    fireEvent(mapView, 'onCameraChanged', {
      properties: { isUserInteraction: true },
    });

    rerender(<Map />);

    // Now recenter button should be visible
    await waitFor(() => {
      expect(screen.getByTestId('recenter-button')).toBeTruthy();
    });
  });

  it('should hide recenter button when user presses it', async () => {
    const { rerender } = render(<Map />);

    // Simulate user moving the map
    const mapView = screen.getByTestId('map-view');
    fireEvent(mapView, 'onCameraChanged', {
      properties: { isUserInteraction: true },
    });

    rerender(<Map />);

    // Recenter button should be visible
    await waitFor(() => {
      expect(screen.getByTestId('recenter-button')).toBeTruthy();
    });

    // Press recenter button
    fireEvent.press(screen.getByTestId('recenter-button'));

    rerender(<Map />);

    // Recenter button should be hidden
    await waitFor(() => {
      expect(screen.queryByTestId('recenter-button')).toBeFalsy();
    });
  });

  it('should open pin detail modal when pin is pressed', async () => {
    render(<Map />);

    // Wait for map pins to load
    await waitFor(() => {
      expect(screen.getByTestId('pin-1')).toBeTruthy();
    });

    // Press a pin
    fireEvent.press(screen.getByTestId('pin-1'));

    // Pin detail modal should be open
    await waitFor(() => {
      expect(screen.getByTestId('pin-detail-modal')).toBeTruthy();
      expect(screen.getByTestId('pin-title')).toHaveTextContent('Test Call');
    });
  });

  it('should close pin detail modal when close button is pressed', async () => {
    render(<Map />);

    // Wait for map pins to load and open modal
    await waitFor(() => {
      expect(screen.getByTestId('pin-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('pin-1'));

    await waitFor(() => {
      expect(screen.getByTestId('pin-detail-modal')).toBeTruthy();
    });

    // Close the modal
    fireEvent.press(screen.getByTestId('close-pin-detail'));

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByTestId('pin-detail-modal')).toBeFalsy();
    });
  });

  it('should set call as current call when button is pressed', async () => {
    render(<Map />);

    // Wait for map pins to load and open modal
    await waitFor(() => {
      expect(screen.getByTestId('pin-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('pin-1'));

    await waitFor(() => {
      expect(screen.getByTestId('pin-detail-modal')).toBeTruthy();
    });

    // Press set as current call button
    fireEvent.press(screen.getByTestId('set-as-current-call'));

    // Should call the core store's setActiveCall method
    await waitFor(() => {
      expect(mockCoreStore.setActiveCall).toHaveBeenCalledWith('1');
    });

    // Should show success toast
    expect(mockToastStore.showToast).toHaveBeenCalledWith('success', 'map.call_set_as_current');
  });

  it('should handle error when setting current call fails', async () => {
    // Mock setActiveCall to throw an error
    mockCoreStore.setActiveCall.mockRejectedValueOnce(new Error('Network error'));

    render(<Map />);

    // Wait for map pins to load and open modal
    await waitFor(() => {
      expect(screen.getByTestId('pin-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('pin-1'));

    await waitFor(() => {
      expect(screen.getByTestId('pin-detail-modal')).toBeTruthy();
    });

    // Press set as current call button
    fireEvent.press(screen.getByTestId('set-as-current-call'));

    // Should show error toast
    await waitFor(() => {
      expect(mockToastStore.showToast).toHaveBeenCalledWith('error', 'map.failed_to_set_current_call');
    });
  });

  it('should not show recenter button when user location is not available', async () => {
    // Mock location store to return null location
    const mockLocationStoreNoLocation = {
      latitude: null,
      longitude: null,
      heading: null,
    };

    jest.mocked(require('@/stores/app/location-store').useLocationStore).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockLocationStoreNoLocation);
      }
      return mockLocationStoreNoLocation;
    });

    const { rerender } = render(<Map />);

    // Simulate user moving the map
    const mapView = screen.getByTestId('map-view');
    fireEvent(mapView, 'onCameraChanged', {
      properties: { isUserInteraction: true },
    });

    rerender(<Map />);

    // Recenter button should not be visible without location
    expect(screen.queryByTestId('recenter-button')).toBeFalsy();
  });

  it('should start location tracking on mount', async () => {
    const { locationService } = require('@/services/location');

    render(<Map />);

    await waitFor(() => {
      expect(locationService.startLocationUpdates).toHaveBeenCalled();
    });
  });

  it('should stop location tracking on unmount', async () => {
    const { locationService } = require('@/services/location');

    const { unmount } = render(<Map />);

    unmount();

    expect(locationService.stopLocationUpdates).toHaveBeenCalled();
  });
}); 