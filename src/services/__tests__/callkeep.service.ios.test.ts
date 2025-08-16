import { Platform } from 'react-native';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RNCallKeep from 'react-native-callkeep';

// Mock react-native-callkeep module
jest.mock('react-native-callkeep');

// Get the mocked module
const mockCallKeep = RNCallKeep as jest.Mocked<typeof RNCallKeep>;

// Mock @livekit/react-native-webrtc
const mockAudioSessionDidActivate = jest.fn();
const mockAudioSessionDidDeactivate = jest.fn();

jest.mock('@livekit/react-native-webrtc', () => ({
  RTCAudioSession: {
    audioSessionDidActivate: mockAudioSessionDidActivate,
    audioSessionDidDeactivate: mockAudioSessionDidDeactivate,
  },
}));

// Mock logger
jest.mock('../../lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
import { CallKeepService, callKeepService } from '../callkeep.service.ios';
import { logger } from '../../lib/logging';

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('CallKeepService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset platform to iOS for most tests
    (Platform as any).OS = 'ios';
  });

  afterEach(() => {
    // Reset the singleton instance for each test
    (CallKeepService as any).instance = null;
  });

  describe('Platform Checks', () => {
    it('should skip setup on non-iOS platforms', async () => {
      (Platform as any).OS = 'android';
      
      const service = CallKeepService.getInstance();
      await service.setup({
        appName: 'Test App',
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: false,
        supportsVideo: false,
      });

      expect(mockCallKeep.setup).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith({
        message: 'CallKeep setup skipped - not iOS platform',
        context: { platform: 'android' },
      });
    });

    it('should skip startCall on non-iOS platforms', async () => {
      (Platform as any).OS = 'android';
      
      const service = CallKeepService.getInstance();
      const result = await service.startCall('test-room');

      expect(result).toBe('');
      expect(mockCallKeep.startCall).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith({
        message: 'CallKeep startCall skipped - not iOS platform',
        context: { platform: 'android' },
      });
    });

    it('should skip endCall on non-iOS platforms', async () => {
      (Platform as any).OS = 'android';
      
      const service = CallKeepService.getInstance();
      await service.endCall();

      expect(mockCallKeep.endCall).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith({
        message: 'CallKeep endCall skipped - not iOS platform',
        context: { platform: 'android' },
      });
    });
  });

  describe('Setup on iOS', () => {
    it('should setup CallKeep with correct configuration', async () => {
      const config = {
        appName: 'Test App',
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: false,
        supportsVideo: false,
      };

      const service = CallKeepService.getInstance();
      await service.setup(config);

      expect(mockCallKeep.setup).toHaveBeenCalledWith({
        ios: {
          appName: 'Test App',
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
          includesCallsInRecents: false,
          supportsVideo: false,
          ringtoneSound: undefined,
        },
        android: {
          alertTitle: 'Permissions required',
          alertDescription: 'This application needs to access your phone accounts',
          cancelButton: 'Cancel',
          okButton: 'OK',
          additionalPermissions: [],
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'CallKeep setup completed successfully',
        context: { config },
      });
    });

    it('should setup event listeners', async () => {
      const service = CallKeepService.getInstance();
      await service.setup({
        appName: 'Test App',
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: false,
        supportsVideo: false,
      });

      expect(mockCallKeep.addEventListener).toHaveBeenCalledWith('didActivateAudioSession', expect.any(Function));
      expect(mockCallKeep.addEventListener).toHaveBeenCalledWith('didDeactivateAudioSession', expect.any(Function));
      expect(mockCallKeep.addEventListener).toHaveBeenCalledWith('endCall', expect.any(Function));
      expect(mockCallKeep.addEventListener).toHaveBeenCalledWith('answerCall', expect.any(Function));
      expect(mockCallKeep.addEventListener).toHaveBeenCalledWith('didPerformSetMutedCallAction', expect.any(Function));
    });
  });

  describe('Start Call on iOS', () => {
    beforeEach(async () => {
      // Setup CallKeep for these tests
      const service = CallKeepService.getInstance();
      await service.setup({
        appName: 'Test App',
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: false,
        supportsVideo: false,
      });
      mockCallKeep.startCall.mockClear();
      mockLogger.info.mockClear();
    });

    it('should start a call with room name', async () => {
      const service = CallKeepService.getInstance();
      const uuid = await service.startCall('emergency-channel');

      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      expect(mockCallKeep.startCall).toHaveBeenCalledWith(
        uuid,
        'Voice Channel',
        'Voice Channel: emergency-channel',
        'generic',
        false
      );
      
      expect(mockCallKeep.reportConnectingOutgoingCallWithUUID).toHaveBeenCalledWith(uuid);
    });

    it('should start a call with custom handle', async () => {
      const service = CallKeepService.getInstance();
      const uuid = await service.startCall('emergency-channel', 'Emergency Line');

      expect(mockCallKeep.startCall).toHaveBeenCalledWith(
        uuid,
        'Emergency Line',
        'Voice Channel: emergency-channel',
        'generic',
        false
      );
    });
  });

  describe('End Call on iOS', () => {
    beforeEach(async () => {
      // Setup and start a call for these tests
      const service = CallKeepService.getInstance();
      await service.setup({
        appName: 'Test App',
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: false,
        supportsVideo: false,
      });
      await service.startCall('test-room');
      mockCallKeep.endCall.mockClear();
      mockLogger.info.mockClear();
    });

    it('should end active call', async () => {
      const service = CallKeepService.getInstance();
      const uuid = service.getCurrentCallUUID();
      
      await service.endCall();

      expect(mockCallKeep.endCall).toHaveBeenCalledWith(uuid);
      expect(service.getCurrentCallUUID()).toBeNull();
      expect(service.isCallActiveNow()).toBe(false);
    });

    it('should handle no active call', async () => {
      const service = CallKeepService.getInstance();
      
      // End the call first
      await service.endCall();
      mockLogger.debug.mockClear();
      mockCallKeep.endCall.mockClear();
      
      // Try to end again
      await service.endCall();

      expect(mockCallKeep.endCall).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith({
        message: 'No active call to end',
      });
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CallKeepService.getInstance();
      const instance2 = CallKeepService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should export singleton instance', () => {
      expect(callKeepService).toBeInstanceOf(CallKeepService);
    });
  });
});
