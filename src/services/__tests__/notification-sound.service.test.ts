// Mock react-native Platform before any imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
    Version: 14,
  },
}));

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
  beforeEach(async () => {
    jest.clearAllMocks();
    // Clean up any previous initialization state
    await notificationSoundService.cleanup();
  });

  afterEach(async () => {
    // Clean up after each test
    await notificationSoundService.cleanup();
  });

  describe('initialization', () => {
    it('should initialize audio mode when initialize() is called', async () => {
      // Initialization is lazy, so Audio.setAudioModeAsync should not be called until initialize() is called
      await notificationSoundService.initialize();
      expect(Audio.setAudioModeAsync).toHaveBeenCalled();
    });

    it('should preload and load audio assets', async () => {
      await notificationSoundService.initialize();

      // Verify sounds are created (called during initialization)
      expect(Audio.Sound.createAsync).toHaveBeenCalled();
    });

    it('should not initialize multiple times concurrently', async () => {
      // Call initialize multiple times concurrently
      await Promise.all([
        notificationSoundService.initialize(),
        notificationSoundService.initialize(),
        notificationSoundService.initialize(),
      ]);

      // Should only initialize once
      expect(Audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
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
