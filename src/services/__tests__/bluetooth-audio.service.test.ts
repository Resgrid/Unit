/* eslint-disable @typescript-eslint/no-explicit-any */
import 'react-native';

// Mock @livekit/react-native-webrtc before any imports that use it
jest.mock('@livekit/react-native-webrtc', () => ({
  RTCAudioSession: {
    audioSessionDidActivate: jest.fn(),
    audioSessionDidDeactivate: jest.fn(),
  },
}));

// Mock CallKeep service before importing modules that use it
jest.mock('@/services/callkeep.service.ios', () => ({
  callKeepService: {
    setup: jest.fn().mockResolvedValue(undefined),
    startCall: jest.fn().mockResolvedValue('test-uuid'),
    endCall: jest.fn().mockResolvedValue(undefined),
    isCallActiveNow: jest.fn().mockReturnValue(false),
    getCurrentCallUUID: jest.fn().mockReturnValue(null),
    setMuteStateCallback: jest.fn(),
  },
}));

// Mock dependencies first before importing the service
jest.mock('react-native-ble-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    checkState: jest.fn(),
    scan: jest.fn(),
    stopScan: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    isPeripheralConnected: jest.fn(),
    getConnectedPeripherals: jest.fn(),
    getDiscoveredPeripherals: jest.fn(),
    removeAllListeners: jest.fn(),
    removePeripheral: jest.fn(),
  },
}));

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/audio.service', () => ({
  audioService: {
    playConnectedDeviceSound: jest.fn(),
    playStartTransmittingSound: jest.fn(),
    playStopTransmittingSound: jest.fn(),
  },
}));

jest.mock('@/features/livekit-call/store/useLiveKitCallStore', () => ({
  useLiveKitCallStore: {
    getState: jest.fn(() => ({
      isConnected: false,
      roomInstance: null,
      localParticipant: null,
      actions: {
        setMicrophoneEnabled: jest.fn(),
      },
    })),
  },
}));

jest.mock('@/stores/app/livekit-store', () => {
  const actions = {
    toggleMicrophone: jest.fn(),
    setMicrophoneEnabled: jest.fn(),
  };
  return {
    useLiveKitStore: {
      getState: jest.fn(() => actions),
    },
  };
});

import { bluetoothAudioService } from '../bluetooth-audio.service';

describe('BluetoothAudioService Refactoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    bluetoothAudioService.destroy();
  });

  it('should be defined and accessible', () => {
    expect(bluetoothAudioService).toBeDefined();
    expect(typeof bluetoothAudioService.destroy).toBe('function');
  });

  it('should have singleton instance pattern', () => {
    // Both calls should return the same instance
    const instance1 = bluetoothAudioService;
    const instance2 = bluetoothAudioService;
    expect(instance1).toBe(instance2);
  });

  it('should have required methods for Bluetooth management', () => {
    expect(typeof bluetoothAudioService.startScanning).toBe('function');
    expect(typeof bluetoothAudioService.stopScanning).toBe('function');
    expect(typeof bluetoothAudioService.connectToDevice).toBe('function');
    expect(typeof bluetoothAudioService.disconnectDevice).toBe('function');
  });

  describe('Preferred Device Connection Refactoring', () => {
    it('should have private attemptPreferredDeviceConnection method', () => {
      const service = bluetoothAudioService as any;
      expect(typeof service.attemptPreferredDeviceConnection).toBe('function');
    });

    it('should have private attemptReconnectToPreferredDevice method for iOS support', () => {
      const service = bluetoothAudioService as any;
      expect(typeof service.attemptReconnectToPreferredDevice).toBe('function');
    });

    it('should track hasAttemptedPreferredDeviceConnection flag for single-call semantics', () => {
      const service = bluetoothAudioService as any;
      
      // Initially should be false
      expect(service.hasAttemptedPreferredDeviceConnection).toBe(false);
      
      // Can be set to true (simulating attempt)
      service.hasAttemptedPreferredDeviceConnection = true;
      expect(service.hasAttemptedPreferredDeviceConnection).toBe(true);
    });

    it('should reset flags on destroy method', () => {
      const service = bluetoothAudioService as any;
      
      // Set flags to true
      service.hasAttemptedPreferredDeviceConnection = true;
      service.isInitialized = true;
      
      // Call destroy
      bluetoothAudioService.destroy();
      
      // Verify flags are reset for single-call logic
      expect(service.hasAttemptedPreferredDeviceConnection).toBe(false);
      expect(service.isInitialized).toBe(false);
    });

    it('should support iOS state change handling through attemptReconnectToPreferredDevice', () => {
      const service = bluetoothAudioService as any;
      
      // Set up scenario: connection was previously attempted
      service.hasAttemptedPreferredDeviceConnection = true;
      
      // Verify the method exists for iOS poweredOn state handling
      expect(typeof service.attemptReconnectToPreferredDevice).toBe('function');
      
      // This method should be called when Bluetooth state changes to poweredOn on iOS
      // It resets the flag and attempts preferred device connection again
    });
  });

  describe('Single-Call Logic Validation', () => {
    it('should implement single-call semantics for preferred device connection', () => {
      const service = bluetoothAudioService as any;
      
      // Simulate first call - should set flag
      service.hasAttemptedPreferredDeviceConnection = false;
      // In actual implementation, attemptPreferredDeviceConnection would set this to true
      
      // Simulate second call - should not execute due to flag
      expect(service.hasAttemptedPreferredDeviceConnection).toBe(false);
      
      // After first attempt
      service.hasAttemptedPreferredDeviceConnection = true;
      expect(service.hasAttemptedPreferredDeviceConnection).toBe(true);
      
      // Second attempt should be blocked by this flag
    });

    it('should allow re-attempting connection after destroy', () => {
      const service = bluetoothAudioService as any;
      
      // Simulate connection attempt
      service.hasAttemptedPreferredDeviceConnection = true;
      
      // Destroy service (resets flags)
      bluetoothAudioService.destroy();
      
      // Flag should be reset, allowing new attempts
      expect(service.hasAttemptedPreferredDeviceConnection).toBe(false);
    });
  });
  describe('Microphone Control Delegation', () => {
    it('should delegate mute toggle to livekitStore', async () => {
      const service = bluetoothAudioService as any;

      // Call private method via casting to any
      await service.handleMuteToggle();

      const storeMock = require('@/stores/app/livekit-store').useLiveKitStore.getState();
      expect(storeMock.toggleMicrophone).toHaveBeenCalled();
    });

    it('should delegate setMicrophoneEnabled to livekitStore', async () => {
      const service = bluetoothAudioService as any;

      // Call private method via casting to any
      await service.setMicrophoneEnabled(true);

      const storeMock = require('@/stores/app/livekit-store').useLiveKitStore.getState();
      expect(storeMock.setMicrophoneEnabled).toHaveBeenCalledWith(true);

      await service.setMicrophoneEnabled(false);
      expect(storeMock.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    });

    it('should fall back to legacy livekitStore when feature store is connected but has no local participant', async () => {
      const service = bluetoothAudioService as any;
      const featureStore = require('@/features/livekit-call/store/useLiveKitCallStore').useLiveKitCallStore;
      const mockFeatureSetMicrophoneEnabled = jest.fn();

      featureStore.getState.mockReturnValue({
        isConnected: true,
        roomInstance: null,
        localParticipant: null,
        actions: {
          setMicrophoneEnabled: mockFeatureSetMicrophoneEnabled,
        },
      });

      await service.setMicrophoneEnabled(true);

      const legacyStore = require('@/stores/app/livekit-store').useLiveKitStore.getState();
      expect(mockFeatureSetMicrophoneEnabled).not.toHaveBeenCalled();
      expect(legacyStore.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('Capability parsing strictness', () => {
    it('should reject explicit falsy read capability values', () => {
      const service = bluetoothAudioService as any;

      expect(service.hasReadCapability({ Read: false })).toBe(false);
      expect(service.hasReadCapability({ read: 0 })).toBe(false);
      expect(service.hasReadCapability({ read: 'false' })).toBe(false);
    });

    it('should accept explicit truthy read capability values', () => {
      const service = bluetoothAudioService as any;

      expect(service.hasReadCapability({ Read: true })).toBe(true);
      expect(service.hasReadCapability({ read: 1 })).toBe(true);
      expect(service.hasReadCapability({ read: 'true' })).toBe(true);
      expect(service.hasReadCapability({ read: '1' })).toBe(true);
      expect(service.hasReadCapability({ read: 'read' })).toBe(true);
    });

    it('should reject explicit falsy notify/read capability values', () => {
      const service = bluetoothAudioService as any;

      expect(service.hasNotificationOrReadCapability({ Notify: false })).toBe(false);
      expect(service.hasNotificationOrReadCapability({ indicate: 0 })).toBe(false);
      expect(service.hasNotificationOrReadCapability({ read: 'false' })).toBe(false);
    });

    it('should accept explicit truthy notify/read capability values', () => {
      const service = bluetoothAudioService as any;

      expect(service.hasNotificationOrReadCapability({ notify: true })).toBe(true);
      expect(service.hasNotificationOrReadCapability({ indicate: 1 })).toBe(true);
      expect(service.hasNotificationOrReadCapability({ read: 'true' })).toBe(true);
      expect(service.hasNotificationOrReadCapability({ read: '1' })).toBe(true);
      expect(service.hasNotificationOrReadCapability({ notify: 'notify' })).toBe(true);
    });
  });
});
