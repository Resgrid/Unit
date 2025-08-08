import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { bluetoothAudioService } from '@/services/bluetooth-audio.service';
import { State, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';

import { BluetoothDeviceSelectionBottomSheet } from '../bluetooth-device-selection-bottom-sheet';

// Mock dependencies
jest.mock('@/services/bluetooth-audio.service', () => ({
  bluetoothAudioService: {
    startScanning: jest.fn(),
    stopScanning: jest.fn(),
    connectToDevice: jest.fn(),
  },
}));

jest.mock('@/lib/hooks/use-preferred-bluetooth-device', () => ({
  usePreferredBluetoothDevice: () => ({
    preferredDevice: null,
    setPreferredDevice: jest.fn(),
  }),
}));

jest.mock('@/stores/app/bluetooth-audio-store', () => ({
  State: {
    PoweredOn: 'poweredOn',
    PoweredOff: 'poweredOff',
    Unauthorized: 'unauthorized',
  },
  useBluetoothAudioStore: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  useWindowDimensions: () => ({
    width: 400,
    height: 800,
  }),
}));

// Mock lucide icons to avoid SVG issues in tests
jest.mock('lucide-react-native', () => ({
  BluetoothIcon: 'BluetoothIcon',
  RefreshCwIcon: 'RefreshCwIcon',
  WifiIcon: 'WifiIcon',
}));

const mockUseBluetoothAudioStore = useBluetoothAudioStore as jest.MockedFunction<typeof useBluetoothAudioStore>;

describe('BluetoothDeviceSelectionBottomSheet', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBluetoothAudioStore.mockReturnValue({
      availableDevices: [
        {
          id: 'test-device-1',
          name: 'Test Headset',
          rssi: -50,
          isConnected: false,
          hasAudioCapability: true,
          supportsMicrophoneControl: true,
          device: {} as any,
        },
        {
          id: 'test-device-2',
          name: 'Test Speaker',
          rssi: -70,
          isConnected: true,
          hasAudioCapability: true,
          supportsMicrophoneControl: false,
          device: {} as any,
        },
      ],
      isScanning: false,
      bluetoothState: State.PoweredOn,
      connectedDevice: {
        id: 'test-device-2',
        name: 'Test Speaker',
        rssi: -70,
        isConnected: true,
        hasAudioCapability: true,
        supportsMicrophoneControl: false,
        device: {} as any,
      },
      connectionError: null,
    } as any);
  });

  it('renders correctly when open', () => {
    render(<BluetoothDeviceSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('bluetooth.select_device')).toBeTruthy();
    expect(screen.getByText('bluetooth.available_devices')).toBeTruthy();
    expect(screen.getByText('Test Headset')).toBeTruthy();
    expect(screen.getByText('Test Speaker')).toBeTruthy();
  });

  it('starts scanning when opened', async () => {
    render(<BluetoothDeviceSelectionBottomSheet {...mockProps} />);

    await waitFor(() => {
      expect(bluetoothAudioService.startScanning).toHaveBeenCalledWith(10000);
    });
  });

  it('displays microphone control capability', () => {
    render(<BluetoothDeviceSelectionBottomSheet {...mockProps} />);

    // Should show microphone control capability
    expect(screen.getByText('bluetooth.supports_mic_control')).toBeTruthy();
  });

  it('displays bluetooth state warnings', () => {
    mockUseBluetoothAudioStore.mockReturnValue({
      availableDevices: [],
      isScanning: false,
      bluetoothState: State.PoweredOff,
      connectedDevice: null,
      connectionError: null,
    } as any);

    render(<BluetoothDeviceSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('bluetooth.bluetooth_disabled')).toBeTruthy();
  });

  it('displays connection errors', () => {
    mockUseBluetoothAudioStore.mockReturnValue({
      availableDevices: [],
      isScanning: false,
      bluetoothState: State.PoweredOn,
      connectedDevice: null,
      connectionError: 'Failed to connect to device',
    } as any);

    render(<BluetoothDeviceSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('Failed to connect to device')).toBeTruthy();
  });

  it('shows scanning state', () => {
    mockUseBluetoothAudioStore.mockReturnValue({
      availableDevices: [],
      isScanning: true,
      bluetoothState: State.PoweredOn,
      connectedDevice: null,
      connectionError: null,
    } as any);

    render(<BluetoothDeviceSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('bluetooth.scanning')).toBeTruthy();
  });
});
