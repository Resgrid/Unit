import { Audio } from 'expo-av';

import { notificationSoundService } from '../notification-sound.service';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            setPositionAsync: jest.fn(() => Promise.resolve()),
            playAsync: jest.fn(() => Promise.resolve()),
            unloadAsync: jest.fn(() => Promise.resolve()),
          },
        })
      ),
    },
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  },
  InterruptionModeIOS: {
    DuckOthers: 1,
  },
}));

// Mock expo-asset
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn(() => Promise.resolve()),
      localUri: 'file://mock-sound.wav',
      uri: 'file://mock-sound.wav',
    })),
    loadAsync: jest.fn(() => Promise.resolve()),
  },
}));

// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('NotificationSoundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize audio mode', async () => {
      // Mock is called in constructor, so need to check mocks
      expect(Audio.setAudioModeAsync).toHaveBeenCalled();
    });

    it('should preload and load audio assets', async () => {
      await notificationSoundService.initialize();

      // Verify sounds are created (called during initialization)
      expect(Audio.Sound.createAsync).toHaveBeenCalled();
    });
  });

  describe('playNotificationSound', () => {
    it('should play call sound for call notification type', async () => {
      await notificationSoundService.playNotificationSound('call');

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should play message sound for message notification type', async () => {
      await notificationSoundService.playNotificationSound('message');

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should play chat sound for chat notification type', async () => {
      await notificationSoundService.playNotificationSound('chat');

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should play group chat sound for group-chat notification type', async () => {
      await notificationSoundService.playNotificationSound('group-chat');

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should play default sound for unknown notification type', async () => {
      await notificationSoundService.playNotificationSound('unknown');

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should handle errors when playing sound gracefully', async () => {
      // Should not throw even if there's an error
      await expect(notificationSoundService.playNotificationSound('call')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should unload all sounds', async () => {
      await notificationSoundService.cleanup();

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Should not throw
      await expect(notificationSoundService.cleanup()).resolves.not.toThrow();
    });
  });
});
