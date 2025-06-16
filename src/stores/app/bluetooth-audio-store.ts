import { type Device, State } from 'react-native-ble-plx';
import { create } from 'zustand';

export interface BluetoothAudioDevice {
  id: string;
  name: string | null;
  rssi?: number;
  isConnected: boolean;
  hasAudioCapability: boolean;
  supportsMicrophoneControl: boolean;
  device: Device;
}

export interface AudioButtonEvent {
  type: 'press' | 'long_press' | 'double_press';
  button: 'play_pause' | 'volume_up' | 'volume_down' | 'mute' | 'unknown';
  timestamp: number;
}

export interface ButtonAction {
  action: 'mute' | 'unmute' | 'volume_up' | 'volume_down';
  timestamp: number;
}

interface BluetoothAudioState {
  // Bluetooth state
  bluetoothState: State;
  isScanning: boolean;
  isConnecting: boolean;

  // Devices
  availableDevices: BluetoothAudioDevice[];
  connectedDevice: BluetoothAudioDevice | null;
  preferredDevice: { id: string; name: string } | null;

  // Connection status
  connectionError: string | null;
  isAudioRoutingActive: boolean;

  // Button events
  buttonEvents: AudioButtonEvent[];
  lastButtonAction: ButtonAction | null;

  // Actions
  setBluetoothState: (state: State) => void;
  setIsScanning: (isScanning: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;

  // Device management
  addDevice: (device: BluetoothAudioDevice) => void;
  updateDevice: (deviceId: string, updates: Partial<BluetoothAudioDevice>) => void;
  removeDevice: (deviceId: string) => void;
  clearDevices: () => void;
  setConnectedDevice: (device: BluetoothAudioDevice | null) => void;
  setPreferredDevice: (device: { id: string; name: string } | null) => void;

  // Connection error management
  setConnectionError: (error: string | null) => void;
  clearConnectionError: () => void;

  // Audio routing
  setAudioRoutingActive: (active: boolean) => void;

  // Button events
  addButtonEvent: (event: AudioButtonEvent) => void;
  clearButtonEvents: () => void;
  setLastButtonAction: (action: ButtonAction | null) => void;
}

export const useBluetoothAudioStore = create<BluetoothAudioState>((set, get) => ({
  // Initial state
  bluetoothState: State.Unknown,
  isScanning: false,
  isConnecting: false,
  availableDevices: [],
  connectedDevice: null,
  preferredDevice: null,
  connectionError: null,
  isAudioRoutingActive: false,
  buttonEvents: [],
  lastButtonAction: null,

  // Bluetooth state actions
  setBluetoothState: (state) => set({ bluetoothState: state }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),

  // Device management actions
  addDevice: (device) => {
    const { availableDevices } = get();
    const existingDeviceIndex = availableDevices.findIndex((d) => d.id === device.id);

    if (existingDeviceIndex >= 0) {
      // Update existing device
      const updatedDevices = [...availableDevices];
      updatedDevices[existingDeviceIndex] = device;
      set({ availableDevices: updatedDevices });
    } else {
      // Add new device
      set({ availableDevices: [...availableDevices, device] });
    }
  },

  updateDevice: (deviceId, updates) => {
    const { availableDevices } = get();
    const updatedDevices = availableDevices.map((device) => (device.id === deviceId ? { ...device, ...updates } : device));
    set({ availableDevices: updatedDevices });
  },

  removeDevice: (deviceId) => {
    const { availableDevices } = get();
    const filteredDevices = availableDevices.filter((device) => device.id !== deviceId);
    set({ availableDevices: filteredDevices });
  },

  clearDevices: () => set({ availableDevices: [] }),

  setConnectedDevice: (device) => {
    set({ connectedDevice: device });

    // Update the device in availableDevices list
    if (device) {
      get().updateDevice(device.id, { isConnected: true });
    }

    // Mark other devices as disconnected
    const { availableDevices } = get();
    const updatedDevices = availableDevices.map((d) => ({
      ...d,
      isConnected: d.id === device?.id,
    }));
    set({ availableDevices: updatedDevices });
  },

  // Connection error management
  setConnectionError: (error) => set({ connectionError: error }),
  clearConnectionError: () => set({ connectionError: null }),

  // Audio routing
  setAudioRoutingActive: (active) => set({ isAudioRoutingActive: active }),

  // Button events
  addButtonEvent: (event) => {
    const { buttonEvents } = get();
    const maxEvents = 50; // Keep only the last 50 events
    const updatedEvents = [event, ...buttonEvents].slice(0, maxEvents);
    set({ buttonEvents: updatedEvents });
  },

  clearButtonEvents: () => set({ buttonEvents: [] }),

  setLastButtonAction: (action) => set({ lastButtonAction: action }),

  // Preferred device management
  setPreferredDevice: (device) => set({ preferredDevice: device }),
}));
