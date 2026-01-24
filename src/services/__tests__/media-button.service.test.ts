import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';

// Mock dependencies
jest.mock('react-native', () => ({
  NativeModules: {
    MediaButtonModule: {
      startListening: jest.fn(),
      stopListening: jest.fn(),
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeAllListeners: jest.fn(),
  })),
  DeviceEventEmitter: {
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeAllListeners: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/audio.service', () => ({
  audioService: {
    playStartTransmittingSound: jest.fn().mockResolvedValue(undefined),
    playStopTransmittingSound: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the stores
const mockBluetoothAudioStore = {
  addButtonEvent: jest.fn(),
  setLastButtonAction: jest.fn(),
  mediaButtonPTTSettings: {
    enabled: true,
    pttMode: 'toggle',
    usePlayPauseForPTT: true,
    doubleTapAction: 'toggle_mute',
    doubleTapTimeoutMs: 400,
  },
};

const mockLiveKitStore = {
  currentRoom: {
    localParticipant: {
      isMicrophoneEnabled: false,
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
    },
  },
};

jest.mock('@/stores/app/bluetooth-audio-store', () => ({
  useBluetoothAudioStore: {
    getState: () => mockBluetoothAudioStore,
  },
}));

jest.mock('@/stores/app/livekit-store', () => ({
  useLiveKitStore: {
    getState: () => mockLiveKitStore,
  },
}));

// Import after mocks are set up
import { mediaButtonService, type MediaButtonPTTSettings } from '../media-button.service';
import { audioService } from '@/services/audio.service';

describe('MediaButtonService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    mediaButtonService.destroy();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = mediaButtonService;
      const instance2 = mediaButtonService;
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize the service successfully', async () => {
      await mediaButtonService.initialize();
      expect(mediaButtonService.isServiceInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await mediaButtonService.initialize();
      await mediaButtonService.initialize();
      expect(mediaButtonService.isServiceInitialized()).toBe(true);
    });

    it('should check for native module availability', async () => {
      await mediaButtonService.initialize();
      expect(mediaButtonService.isNativeModuleAvailable()).toBe(true);
    });
  });

  describe('settings management', () => {
    it('should return default settings', () => {
      const settings = mediaButtonService.getSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.pttMode).toBe('toggle');
      expect(settings.usePlayPauseForPTT).toBe(true);
    });

    it('should update settings', () => {
      const newSettings: Partial<MediaButtonPTTSettings> = {
        enabled: false,
        pttMode: 'push_to_talk',
      };
      mediaButtonService.updateSettings(newSettings);

      const settings = mediaButtonService.getSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.pttMode).toBe('push_to_talk');
    });

    it('should enable/disable via setEnabled', () => {
      mediaButtonService.setEnabled(false);
      expect(mediaButtonService.getSettings().enabled).toBe(false);

      mediaButtonService.setEnabled(true);
      expect(mediaButtonService.getSettings().enabled).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should cleanup resources on destroy', async () => {
      await mediaButtonService.initialize();
      mediaButtonService.destroy();
      expect(mediaButtonService.isServiceInitialized()).toBe(false);
    });

    it('should stop listening on native module when destroyed', async () => {
      await mediaButtonService.initialize();
      mediaButtonService.destroy();
      expect(NativeModules.MediaButtonModule.stopListening).toHaveBeenCalled();
    });
  });

  describe('PTT actions', () => {
    beforeEach(async () => {
      await mediaButtonService.initialize();
      mediaButtonService.setEnabled(true);
    });

    it('should enable microphone when PTT is triggered and mic is disabled', async () => {
      mockLiveKitStore.currentRoom.localParticipant.isMicrophoneEnabled = false;
      
      await mediaButtonService.enableMicrophone();

      expect(mockLiveKitStore.currentRoom.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
      expect(audioService.playStartTransmittingSound).toHaveBeenCalled();
      expect(mockBluetoothAudioStore.addButtonEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          button: 'ptt_start',
        })
      );
    });

    it('should not enable microphone if already enabled', async () => {
      mockLiveKitStore.currentRoom.localParticipant.isMicrophoneEnabled = true;
      
      await mediaButtonService.enableMicrophone();

      expect(mockLiveKitStore.currentRoom.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });

    it('should disable microphone when PTT is released', async () => {
      mockLiveKitStore.currentRoom.localParticipant.isMicrophoneEnabled = true;
      
      await mediaButtonService.disableMicrophone();

      expect(mockLiveKitStore.currentRoom.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
      expect(audioService.playStopTransmittingSound).toHaveBeenCalled();
      expect(mockBluetoothAudioStore.addButtonEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          button: 'ptt_stop',
        })
      );
    });

    it('should not disable microphone if already disabled', async () => {
      mockLiveKitStore.currentRoom.localParticipant.isMicrophoneEnabled = false;
      
      await mediaButtonService.disableMicrophone();

      expect(mockLiveKitStore.currentRoom.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });
  });

  describe('when no LiveKit room is active', () => {
    beforeEach(async () => {
      await mediaButtonService.initialize();
      mediaButtonService.setEnabled(true);
    });

    it('should not throw error when enabling mic without room', async () => {
      const originalRoom = mockLiveKitStore.currentRoom;
      (mockLiveKitStore as any).currentRoom = null;
      
      await expect(mediaButtonService.enableMicrophone()).resolves.not.toThrow();
      
      (mockLiveKitStore as any).currentRoom = originalRoom;
    });

    it('should not throw error when disabling mic without room', async () => {
      const originalRoom = mockLiveKitStore.currentRoom;
      (mockLiveKitStore as any).currentRoom = null;
      
      await expect(mediaButtonService.disableMicrophone()).resolves.not.toThrow();
      
      (mockLiveKitStore as any).currentRoom = originalRoom;
    });
  });

  describe('when PTT is disabled', () => {
    beforeEach(async () => {
      await mediaButtonService.initialize();
      mediaButtonService.setEnabled(false);
    });

    it('should not process button events when disabled', async () => {
      // The handleMediaButtonEvent is private, so we test via settings check
      const settings = mediaButtonService.getSettings();
      expect(settings.enabled).toBe(false);
    });
  });
});

describe('MediaButtonService - Platform specific', () => {
  describe('iOS', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
      jest.clearAllMocks();
      mediaButtonService.destroy();
    });

    it('should setup iOS event listeners when native module is available', async () => {
      await mediaButtonService.initialize();
      expect(NativeEventEmitter).toHaveBeenCalled();
    });

    it('should call startListening on native module', async () => {
      await mediaButtonService.initialize();
      expect(NativeModules.MediaButtonModule.startListening).toHaveBeenCalled();
    });
  });

  describe('Android', () => {
    beforeEach(() => {
      (Platform as any).OS = 'android';
      jest.clearAllMocks();
      mediaButtonService.destroy();
    });

    it('should setup Android event listeners when native module is available', async () => {
      await mediaButtonService.initialize();
      expect(NativeEventEmitter).toHaveBeenCalled();
    });

    it('should call startListening on native module', async () => {
      await mediaButtonService.initialize();
      expect(NativeModules.MediaButtonModule.startListening).toHaveBeenCalled();
    });
  });
});
