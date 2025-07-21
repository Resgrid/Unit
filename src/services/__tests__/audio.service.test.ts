import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStartTransmittingPlayer = {
  play: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(),
  playing: false,
  paused: false,
  isLoaded: true,
};

const mockStopTransmittingPlayer = {
  play: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(),
  playing: false,
  paused: false,
  isLoaded: true,
};

const mockConnectedDevicePlayer = {
  play: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(),
  playing: false,
  paused: false,
  isLoaded: true,
};

const mockConnectToAudioRoomPlayer = {
  play: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(),
  playing: false,
  paused: false,
  isLoaded: true,
};

const mockDisconnectedFromAudioRoomPlayer = {
  play: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(),
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
jest.mock('../../assets/audio/ui/space_notification1.mp3', () => 'mocked-start-transmitting-sound', { virtual: true });
jest.mock('../../assets/audio/ui/space_notification2.mp3', () => 'mocked-stop-transmitting-sound', { virtual: true });
jest.mock('../../assets/audio/ui/positive_interface_beep.mp3', () => 'mocked-connected-device-sound', { virtual: true });
jest.mock('../../assets/audio/ui/software_interface_start.mp3', () => 'mocked-connect-to-audio-room-sound', { virtual: true });
jest.mock('../../assets/audio/ui/software_interface_back.mp3', () => 'mocked-disconnected-from-audio-room-sound', { virtual: true });

describe('AudioService', () => {
  let audioService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mock to return different players for different calls
    mockCreateAudioPlayer
      .mockReturnValueOnce(mockStartTransmittingPlayer as any)
      .mockReturnValueOnce(mockStopTransmittingPlayer as any)
      .mockReturnValueOnce(mockConnectedDevicePlayer as any)
      .mockReturnValueOnce(mockConnectToAudioRoomPlayer as any)
      .mockReturnValueOnce(mockDisconnectedFromAudioRoomPlayer as any);
    
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

  describe('playStartTransmittingSound', () => {
    it('should play start transmitting sound successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.playStartTransmittingSound();

      expect(mockStartTransmittingPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockStartTransmittingPlayer.play).toHaveBeenCalled();
    });

    it('should handle start transmitting sound playback errors', async () => {
      jest.clearAllMocks();
      mockStartTransmittingPlayer.play.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playStartTransmittingSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'startTransmitting', error: expect.any(Error) },
      });
    });
  });

  describe('playStopTransmittingSound', () => {
    it('should play stop transmitting sound successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.playStopTransmittingSound();

      expect(mockStopTransmittingPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockStopTransmittingPlayer.play).toHaveBeenCalled();
    });

    it('should handle stop transmitting sound playback errors', async () => {
      jest.clearAllMocks();
      mockStopTransmittingPlayer.play.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playStopTransmittingSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'stopTransmitting', error: expect.any(Error) },
      });
    });
  });

  describe('playConnectedDeviceSound', () => {
    it('should play connected device sound successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.playConnectedDeviceSound();

      expect(mockConnectedDevicePlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockConnectedDevicePlayer.play).toHaveBeenCalled();
    });

    it('should handle connected device sound playback errors', async () => {
      jest.clearAllMocks();
      mockConnectedDevicePlayer.play.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playConnectedDeviceSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'connectedDevice', error: expect.any(Error) },
      });
    });
  });

  describe('playConnectToAudioRoomSound', () => {
    it('should play connect to audio room sound successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.playConnectToAudioRoomSound();

      expect(mockConnectToAudioRoomPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockConnectToAudioRoomPlayer.play).toHaveBeenCalled();
    });

    it('should handle connect to audio room sound playback errors', async () => {
      jest.clearAllMocks();
      mockConnectToAudioRoomPlayer.play.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playConnectToAudioRoomSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'connectedToAudioRoom', error: expect.any(Error) },
      });
    });
  });

  describe('playDisconnectedFromAudioRoomSound', () => {
    it('should play disconnected from audio room sound successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.playDisconnectedFromAudioRoomSound();

      expect(mockDisconnectedFromAudioRoomPlayer.seekTo).toHaveBeenCalledWith(0);
      expect(mockDisconnectedFromAudioRoomPlayer.play).toHaveBeenCalled();
    });

    it('should handle disconnected from audio room sound playback errors', async () => {
      jest.clearAllMocks();
      mockDisconnectedFromAudioRoomPlayer.play.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playDisconnectedFromAudioRoomSound();

      expect(logger.error).toHaveBeenCalledWith({
        message: 'Failed to play sound',
        context: { soundName: 'disconnectedFromAudioRoom', error: expect.any(Error) },
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup audio resources successfully', async () => {
      jest.clearAllMocks();
      
      await audioService.cleanup();

      expect(mockStartTransmittingPlayer.remove).toHaveBeenCalledTimes(1);
      expect(mockStopTransmittingPlayer.remove).toHaveBeenCalledTimes(1);
      expect(mockConnectedDevicePlayer.remove).toHaveBeenCalledTimes(1);
      expect(mockConnectToAudioRoomPlayer.remove).toHaveBeenCalledTimes(1);
      expect(mockDisconnectedFromAudioRoomPlayer.remove).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({
        message: 'Audio service cleaned up',
      });
    });
  });
});
