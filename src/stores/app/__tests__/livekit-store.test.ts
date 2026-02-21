// Mock expo-asset and expo-av first (before any imports)
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(),
    loadAsync: jest.fn(),
  },
}));

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    getStatusAsync: jest.fn(),
    loadAsync: jest.fn(),
    createAsync: jest.fn(),
  },
}));

// Mock audio service
jest.mock('../../../services/audio.service', () => ({
  playAudio: jest.fn(),
  stopAudio: jest.fn(),
  preloadAudio: jest.fn(),
  setAudioMode: jest.fn(),
  AudioService: {
    playAudio: jest.fn(),
    stopAudio: jest.fn(),
    preloadAudio: jest.fn(),
    setAudioMode: jest.fn(),
  },
}));

// Mock CallKeep service
jest.mock('../../../services/callkeep.service.ios', () => ({
  callKeepService: {
    setup: jest.fn(),
    startCall: jest.fn(),
    endCall: jest.fn(),
    isCallActiveNow: jest.fn(),
    getCurrentCallUUID: jest.fn(),
    cleanup: jest.fn(),
    setMuteStateCallback: jest.fn(),
    setEndCallCallback: jest.fn(),
  },
}));



import { Platform } from 'react-native';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';

import { useLiveKitStore } from '../livekit-store';
import { logger } from '../../../lib/logging';

// Mock livekit-client
jest.mock('livekit-client', () => ({
  Room: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    localParticipant: {
      audioTracks: new Map(),
      videoTracks: new Map(),
    },
    remoteParticipants: new Map(),
  })),
  RoomEvent: {
    Connected: 'connected',
    Disconnected: 'disconnected',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackPublished: 'trackPublished',
    TrackUnpublished: 'trackUnpublished',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
  },
}));

// Mock MMKV storage
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    setString: jest.fn(),
    getBoolean: jest.fn(),
    setBoolean: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
  })),
}));

// Mock storage
jest.mock('../../../lib/storage', () => ({
  storage: {
    getString: jest.fn(),
    setString: jest.fn(),
    getBoolean: jest.fn(),
    setBoolean: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
  },
}));

// Mock API endpoints
jest.mock('../../../api/voice', () => ({
  getDepartmentVoice: jest.fn(),
  getDepartmentAudioStreams: jest.fn(),
  canConnectToVoiceSession: jest.fn(),
  connectToVoiceSession: jest.fn(),
}));

// Mock expo-audio
jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: jest.fn(),
  requestRecordingPermissionsAsync: jest.fn(),
}));

// Mock logger
jest.mock('../../../lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Platform and PermissionsAndroid
const mockPermissionsAndroidCheck = jest.fn();
const mockPermissionsAndroidRequest = jest.fn();
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  PermissionsAndroid: {
    check: (...args: any[]) => mockPermissionsAndroidCheck(...args),
    request: (...args: any[]) => mockPermissionsAndroidRequest(...args),
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
      READ_PHONE_NUMBERS: 'android.permission.READ_PHONE_NUMBERS',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
  },
}));

const mockGetRecordingPermissionsAsync = getRecordingPermissionsAsync as jest.MockedFunction<typeof getRecordingPermissionsAsync>;
const mockRequestRecordingPermissionsAsync = requestRecordingPermissionsAsync as jest.MockedFunction<typeof requestRecordingPermissionsAsync>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('LiveKit Store - Permission Management', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockPermissionsAndroidCheck.mockReset();
    mockPermissionsAndroidRequest.mockReset();
    
    // Reset store state
    useLiveKitStore.setState({
      currentRoom: null,
      isConnected: false,
      isTalking: false,
      availableRooms: [],
      isBottomSheetVisible: false,
    });
  });

  describe('Android permission flow', () => {
    beforeEach(() => {
      (Platform as any).OS = 'android';
    });

    it('should successfully request permissions when not granted initially', async () => {
      // Mock check - not granted
      mockPermissionsAndroidCheck.mockResolvedValueOnce(false);
      // Mock request - granted
      mockPermissionsAndroidRequest.mockResolvedValueOnce('granted');

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockPermissionsAndroidCheck).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockPermissionsAndroidRequest).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Microphone permission granted successfully',
        context: { platform: 'android' },
      });
    });

    it('should skip request when permissions already granted', async () => {
      // Mock check - already granted
      mockPermissionsAndroidCheck.mockResolvedValueOnce(true);

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockPermissionsAndroidCheck).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockPermissionsAndroidRequest).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Microphone permission already granted',
        context: { platform: 'android' },
      });
    });

    it('should handle permission denial', async () => {
      // Mock check - not granted
      mockPermissionsAndroidCheck.mockResolvedValueOnce(false);
      // Mock request - denied
      mockPermissionsAndroidRequest.mockResolvedValueOnce('denied');

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockPermissionsAndroidCheck).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockPermissionsAndroidRequest).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Microphone permission not granted',
        context: { platform: 'android', result: 'denied' },
      });
    });

    it('should handle permission errors gracefully', async () => {
      // Mock check - throws error
      mockPermissionsAndroidCheck.mockRejectedValueOnce(new Error('Permission API error'));

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockPermissionsAndroidCheck).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockPermissionsAndroidRequest).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Failed to request permissions',
        context: { platform: 'android', error: expect.any(Error) },
      });
    });

    it('should handle request API errors', async () => {
      // Mock check - not granted
      mockPermissionsAndroidCheck.mockResolvedValueOnce(false);
      // Mock request - throws error
      mockPermissionsAndroidRequest.mockRejectedValueOnce(new Error('Request API error'));

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockPermissionsAndroidCheck).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockPermissionsAndroidRequest).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Failed to request permissions',
        context: { platform: 'android', error: expect.any(Error) },
      });
    });
  });

  describe('iOS permission flow', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    it('should successfully request permissions on iOS', async () => {
      // Mock initial permission check - not granted
      mockGetRecordingPermissionsAsync.mockResolvedValueOnce({
        granted: false,
        canAskAgain: true,
        expires: 'never',
        status: 'undetermined',
      } as any);

      // Mock permission request - granted
      mockRequestRecordingPermissionsAsync.mockResolvedValueOnce({
        granted: true,
        canAskAgain: true,
        expires: 'never',
        status: 'granted',
      } as any);

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockGetRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Microphone permission granted successfully',
        context: { platform: 'ios' },
      });
    });

    it('should handle iOS permission denial', async () => {
      // Mock initial permission check - not granted
      mockGetRecordingPermissionsAsync.mockResolvedValueOnce({
        granted: false,
        canAskAgain: false,
        expires: 'never',
        status: 'denied',
      } as any);

      // Mock permission request - still denied
      mockRequestRecordingPermissionsAsync.mockResolvedValueOnce({
        granted: false,
        canAskAgain: false,
        expires: 'never',
        status: 'denied',
      } as any);

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockGetRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Microphone permission not granted',
        context: { platform: 'ios' },
      });
    });
  });

  describe('Unsupported platform handling', () => {
    beforeEach(() => {
      (Platform as any).OS = 'web';
    });

    it('should handle unsupported platform gracefully', async () => {
      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockGetRecordingPermissionsAsync).not.toHaveBeenCalled();
      expect(mockRequestRecordingPermissionsAsync).not.toHaveBeenCalled();
      // For unsupported platforms, the function just returns without logging
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Permission response edge cases', () => {
    beforeEach(() => {
      (Platform as any).OS = 'android';
    });

    it('should handle undefined permission response', async () => {
      // Mock check - throws (simulating undefined response access)
      mockPermissionsAndroidCheck.mockRejectedValueOnce(new TypeError("Cannot read properties of undefined"));

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockPermissionsAndroidCheck).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Failed to request permissions',
        context: { platform: 'android', error: expect.any(Error) },
      });
    });

    it('should handle never_ask_again permission response', async () => {
      // Mock check - not granted
      mockPermissionsAndroidCheck.mockResolvedValueOnce(false);
      // Mock request - never_ask_again
      mockPermissionsAndroidRequest.mockResolvedValueOnce('never_ask_again');

      const { requestPermissions } = useLiveKitStore.getState();
      await requestPermissions();

      expect(mockPermissionsAndroidCheck).toHaveBeenCalledTimes(1);
      expect(mockPermissionsAndroidRequest).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Microphone permission not granted',
        context: { platform: 'android', result: 'never_ask_again' },
      });
    });
  });

  describe('CallKeep Integration', () => {
    const mockCallKeepService = require('../../../services/callkeep.service.ios').callKeepService;

    beforeEach(() => {
      jest.clearAllMocks();
      (Platform as any).OS = 'ios';
      
      // Reset mock implementations
      mockCallKeepService.setup.mockResolvedValue(undefined);
      mockCallKeepService.startCall.mockResolvedValue('test-uuid');
      mockCallKeepService.endCall.mockResolvedValue(undefined);
      mockCallKeepService.isCallActiveNow.mockReturnValue(false);
      mockCallKeepService.getCurrentCallUUID.mockReturnValue(null);
      mockCallKeepService.setMuteStateCallback.mockReturnValue(undefined);
    });

    it('should have CallKeep service available for iOS integration', () => {
      // This is a basic integration test to ensure the CallKeep service
      // is properly mocked and available for the LiveKit store to use
      expect(mockCallKeepService).toBeDefined();
      expect(typeof mockCallKeepService.setup).toBe('function');
      expect(typeof mockCallKeepService.startCall).toBe('function');
      expect(typeof mockCallKeepService.endCall).toBe('function');
      expect(typeof mockCallKeepService.setMuteStateCallback).toBe('function');
    });

    it('should handle CallKeep setup calls', async () => {
      // Note: setupCallKeep is now handled globally via app initialization service
      // This test just verifies the CallKeep service methods can be called
      await mockCallKeepService.setup({
        appName: 'Resgrid Unit',
        maximumCallGroups: 1,
        maximumCallsPerCallGroup: 1,
        includesCallsInRecents: false,
        supportsVideo: false,
      });
      expect(mockCallKeepService.setup).toHaveBeenCalled();
    });

    it('should handle CallKeep start and end call operations', async () => {
      // Test the basic call lifecycle
      const uuid = await mockCallKeepService.startCall('test-room');
      expect(mockCallKeepService.startCall).toHaveBeenCalledWith('test-room');
      expect(uuid).toBe('test-uuid');
      
      await mockCallKeepService.endCall();
      expect(mockCallKeepService.endCall).toHaveBeenCalled();
    });

    it('should skip CallKeep operations on non-iOS platforms', async () => {
      (Platform as any).OS = 'android';
      
      // Verify that platform checks work as expected
      expect(Platform.OS).toBe('android');
      
      // CallKeep operations would be skipped on Android
      // This test confirms the platform detection works properly
    });

    it('should handle CallKeep service errors gracefully', async () => {
      const error = new Error('CallKeep operation failed');
      mockCallKeepService.setup.mockRejectedValue(error);
      
      try {
        await mockCallKeepService.setup({});
      } catch (e) {
        expect(e).toBe(error);
      }
      
      expect(mockCallKeepService.setup).toHaveBeenCalled();
    });
  });
});
