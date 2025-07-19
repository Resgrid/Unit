import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockConnectionPlayer = {
  play: jest.fn(),
  remove: jest.fn(),
  playing: false,
  paused: false,
  isLoaded: true,
};

const mockDisconnectionPlayer = {
  play: jest.fn(),
  remove: jest.fn(),
  playing: false,
  paused: false,
  isLoaded: true,
};

// Mock expo-audio
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj: any) => obj.ios),
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

import { createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { logger } from '@/lib/logging';

const mockCreateAudioPlayer = createAudioPlayer as jest.MockedFunction<typeof createAudioPlayer>;

// Mock the require calls for audio files
jest.mock('../../assets/audio/ui/space_notification1.mp3', () => 'mocked-connection-sound', { virtual: true });
jest.mock('../../assets/audio/ui/space_notification2.mp3', () => 'mocked-disconnection-sound', { virtual: true });

describe('AudioService', () => {
  let audioService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mock to return different players for different calls
    mockCreateAudioPlayer
      .mockReturnValueOnce(mockConnectionPlayer as any)
      .mockReturnValueOnce(mockDisconnectionPlayer as any);
    
    // Import the service after setting up mocks
    const AudioServiceModule = require('../audio.service');
    audioService = AudioServiceModule.audioService;
    
    // Wait for async initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('initialization', () => {
    it('should initialize audio service successfully', async () => {
      expect(logger.debug).toHaveBeenCalledWith({
        message: 'Audio files loaded successfully',
      });
      
      expect(logger.info).toHaveBeenCalledWith({
        message: 'Audio service initialized',
      });
    });
  });

  describe('playConnectionSound', () => {
    it('should play connection sound successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.playConnectionSound();

      expect(mockConnectionPlayer.play).toHaveBeenCalled();
    });

    it('should handle connection sound playback errors', async () => {
      jest.clearAllMocks();
      mockConnectionPlayer.play.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playConnectionSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'connection', error: expect.any(Error) },
      });
    });
  });

  describe('playDisconnectionSound', () => {
    it('should play disconnection sound successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.playDisconnectionSound();

      expect(mockDisconnectionPlayer.play).toHaveBeenCalled();
    });

    it('should handle disconnection sound playback errors', async () => {
      jest.clearAllMocks();
      mockDisconnectionPlayer.play.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playDisconnectionSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'disconnection', error: expect.any(Error) },
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup audio resources successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.cleanup();

      expect(mockConnectionPlayer.remove).toHaveBeenCalledTimes(1);
      expect(mockDisconnectionPlayer.remove).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({
        message: 'Audio service cleaned up',
      });
    });
  });
});
