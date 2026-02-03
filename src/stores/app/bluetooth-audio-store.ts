import { type Peripheral } from 'react-native-ble-manager';
import { create } from 'zustand';

import { createDefaultPTTSettings, DEFAULT_MEDIA_BUTTON_PTT_SETTINGS, type MediaButtonPTTSettings, type PTTMode } from '@/types/ptt';

// Re-export PTT types for backwards compatibility
export { DEFAULT_MEDIA_BUTTON_PTT_SETTINGS, type MediaButtonPTTSettings, type PTTMode };

// Re-export Peripheral as Device for compatibility
export type Device = Peripheral;

// Bluetooth state enum to match react-native-ble-plx API
export enum State {
  Unknown = 'unknown',
  Resetting = 'resetting',
  Unsupported = 'unsupported',
  Unauthorized = 'unauthorized',
  PoweredOff = 'poweredOff',
  PoweredOn = 'poweredOn',
}

export interface BluetoothAudioDevice {
  id: string;
  name: string | null;
  rssi?: number;
  isConnected: boolean;
  hasAudioCapability: boolean;
  supportsMicrophoneControl: boolean;
  device: Device;
  type: 'specialized' | 'system';
}

export interface BluetoothSystemAudioDevice {
     id: string;
     name: string;
     type: 'system';
}

export interface AudioButtonEvent {
  type: 'press' | 'long_press' | 'double_press';
  button: 'ptt_start' | 'ptt_stop' | 'volume_up' | 'volume_down' | 'mute' | 'unknown';
  timestamp: number;
}

export interface ButtonAction {
  action: 'mute' | 'unmute' | 'volume_up' | 'volume_down';
  timestamp: number;
}

export interface AudioDeviceInfo {
  id: string;
  name: string;
  type: 'bluetooth' | 'wired' | 'speaker' | 'default' | 'microphone';
  isAvailable: boolean;
}

export interface AudioDeviceSelection {
  microphone: AudioDeviceInfo | null;
  speaker: AudioDeviceInfo | null;
}

interface BluetoothAudioState {
  // Bluetooth state
  bluetoothState: State;
  isScanning: boolean;
  isConnecting: boolean;
  isHeadsetButtonMonitoring: boolean;

  // Devices
  availableDevices: BluetoothAudioDevice[];
  connectedDevice: BluetoothAudioDevice | null;
  preferredDevice: { id: string; name: string } | null;

  // Audio device selection
  availableAudioDevices: AudioDeviceInfo[];
  selectedAudioDevices: AudioDeviceSelection;

  // Connection status
  connectionError: string | null;
  isAudioRoutingActive: boolean;

  // Button events
  buttonEvents: AudioButtonEvent[];
  lastButtonAction: ButtonAction | null;

  // Media button PTT settings (for AirPods/earbuds)
  mediaButtonPTTSettings: MediaButtonPTTSettings;

  // Actions
  setBluetoothState: (state: State) => void;
  setIsScanning: (isScanning: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setIsHeadsetButtonMonitoring: (isMonitoring: boolean) => void;

  // Device management
  addDevice: (device: BluetoothAudioDevice) => void;
  updateDevice: (deviceId: string, updates: Partial<BluetoothAudioDevice>) => void;
  removeDevice: (deviceId: string) => void;
  clearDevices: () => void;
  setConnectedDevice: (device: BluetoothAudioDevice | null) => void;
  setPreferredDevice: (device: { id: string; name: string } | null) => void;

  // Audio device selection
  setAvailableAudioDevices: (devices: AudioDeviceInfo[]) => void;
  setSelectedMicrophone: (device: AudioDeviceInfo | null) => void;
  setSelectedSpeaker: (device: AudioDeviceInfo | null) => void;
  updateAudioDeviceAvailability: (deviceId: string, isAvailable: boolean) => void;

  // Connection error management
  setConnectionError: (error: string | null) => void;
  clearConnectionError: () => void;

  // Audio routing
  setAudioRoutingActive: (active: boolean) => void;

  // Button events
  addButtonEvent: (event: AudioButtonEvent) => void;
  clearButtonEvents: () => void;
  setLastButtonAction: (action: ButtonAction | null) => void;

  // Media button PTT settings (for AirPods/earbuds)
  setMediaButtonPTTSettings: (settings: Partial<MediaButtonPTTSettings>) => void;
  setMediaButtonPTTEnabled: (enabled: boolean) => void;
}

// Initial state
export const INITIAL_STATE: Omit<
  BluetoothAudioState,
  | 'setBluetoothState'
  | 'setIsScanning'
  | 'setIsConnecting'
  | 'addDevice'
  | 'updateDevice'
  | 'removeDevice'
  | 'clearDevices'
  | 'setConnectedDevice'
  | 'setPreferredDevice'
  | 'setAvailableAudioDevices'
  | 'setSelectedMicrophone'
  | 'setSelectedSpeaker'
  | 'updateAudioDeviceAvailability'
  | 'setConnectionError'
  | 'clearConnectionError'
  | 'setAudioRoutingActive'
  | 'addButtonEvent'
  | 'clearButtonEvents'
  | 'setLastButtonAction'
  | 'setMediaButtonPTTSettings'
  | 'setMediaButtonPTTEnabled'
  | 'setIsHeadsetButtonMonitoring'
> = {
  bluetoothState: State.Unknown,
  isScanning: false,
  isConnecting: false,
  isHeadsetButtonMonitoring: false,
  availableDevices: [],
  connectedDevice: null,
  preferredDevice: null,
  availableAudioDevices: [
    { id: 'default-mic', name: 'Default Microphone', type: 'microphone', isAvailable: true },
    { id: 'default-speaker', name: 'Default Speaker', type: 'speaker', isAvailable: true },
  ],
  selectedAudioDevices: {
    microphone: { id: 'default-mic', name: 'Default Microphone', type: 'microphone', isAvailable: true },
    speaker: { id: 'default-speaker', name: 'Default Speaker', type: 'speaker', isAvailable: true },
  },
  connectionError: null,
  isAudioRoutingActive: false,
  buttonEvents: [],
  lastButtonAction: null,
  mediaButtonPTTSettings: createDefaultPTTSettings(),
};

export const useBluetoothAudioStore = create<BluetoothAudioState>((set, get) => ({
  ...INITIAL_STATE,

  // Bluetooth state actions
  setBluetoothState: (state) => set({ bluetoothState: state }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setIsHeadsetButtonMonitoring: (isHeadsetButtonMonitoring) => set({ isHeadsetButtonMonitoring }),

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

  // Audio device selection actions
  setAvailableAudioDevices: (devices) => set({ availableAudioDevices: devices }),

  setSelectedMicrophone: (device) => {
    const { selectedAudioDevices } = get();
    set({
      selectedAudioDevices: {
        ...selectedAudioDevices,
        microphone: device,
      },
    });
  },

  setSelectedSpeaker: (device) => {
    const { selectedAudioDevices } = get();
    set({
      selectedAudioDevices: {
        ...selectedAudioDevices,
        speaker: device,
      },
    });
  },

  updateAudioDeviceAvailability: (deviceId, isAvailable) => {
    const { availableAudioDevices } = get();
    const updatedDevices = availableAudioDevices.map((device) => (device.id === deviceId ? { ...device, isAvailable } : device));
    set({ availableAudioDevices: updatedDevices });
  },

  // Media button PTT settings actions
  setMediaButtonPTTSettings: (settings) => {
    const { mediaButtonPTTSettings } = get();
    set({
      mediaButtonPTTSettings: {
        ...mediaButtonPTTSettings,
        ...settings,
      },
    });
  },

  setMediaButtonPTTEnabled: (enabled) => {
    const { mediaButtonPTTSettings } = get();
    set({
      mediaButtonPTTSettings: {
        ...mediaButtonPTTSettings,
        enabled,
      },
    });
  },
}));
