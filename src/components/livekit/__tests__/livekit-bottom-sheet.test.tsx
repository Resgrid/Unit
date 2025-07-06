import { render } from '@testing-library/react-native';
import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock React Native and NativeWind
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  Headphones: 'MockHeadphones',
  Mic: 'MockMic',
  MicOff: 'MockMicOff',
  PhoneOff: 'MockPhoneOff',
  Settings: 'MockSettings',
}));

// Mock the stores
jest.mock('@/stores/app/livekit-store');
jest.mock('@/stores/app/bluetooth-audio-store');
jest.mock('../../settings/audio-device-selection', () => ({
  AudioDeviceSelection: 'MockAudioDeviceSelection',
}));

// Mock i18next
jest.mock('i18next', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'livekit.title': 'Voice Channels',
      'livekit.no_rooms_available': 'No voice channels available',
      'livekit.join': 'Join',
      'livekit.connecting': 'Connecting...',
      'livekit.connected_to_room': 'Connected to Channel',
      'livekit.speaking': 'Speaking',
      'livekit.audio_devices': 'Audio Devices',
      'livekit.microphone': 'Microphone',
      'livekit.speaker': 'Speaker',
      'livekit.mute': 'Mute',
      'livekit.unmute': 'Unmute',
      'livekit.audio_settings': 'Audio Settings',
      'livekit.disconnect': 'Disconnect',
      'common.back': 'Back',
      'common.unknown': 'Unknown',
    };
    return translations[key] || key;
  },
}));

// Import after mocks to avoid the React Native CSS Interop issue
import { useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';
import { BottomSheetView, LiveKitBottomSheet } from '../livekit-bottom-sheet';

const mockRoom = {
  localParticipant: {
    isMicrophoneEnabled: false,
    setMicrophoneEnabled: jest.fn(),
  },
};

const mockCurrentRoomInfo = {
  Id: 'room1',
  Name: 'Test Room',
  Token: 'test-token',
};

const mockAvailableRooms = [
  {
    Id: 'room1',
    Name: 'Emergency Channel',
    Token: 'token1',
  },
  {
    Id: 'room2',
    Name: 'Dispatch Channel',
    Token: 'token2',
  },
];

const mockSelectedAudioDevices = {
  microphone: { id: 'mic1', name: 'Default Microphone', type: 'default' as const, isAvailable: true },
  speaker: { id: 'speaker1', name: 'Default Speaker', type: 'default' as const, isAvailable: true },
};

describe('LiveKitBottomSheet', () => {
  const mockUseLiveKitStore = useLiveKitStore as jest.MockedFunction<typeof useLiveKitStore>;
  const mockUseBluetoothAudioStore = useBluetoothAudioStore as jest.MockedFunction<typeof useBluetoothAudioStore>;

  const defaultLiveKitState = {
    isBottomSheetVisible: false,
    setIsBottomSheetVisible: jest.fn(),
    availableRooms: [],
    fetchVoiceSettings: jest.fn(),
    connectToRoom: jest.fn(),
    disconnectFromRoom: jest.fn(),
    currentRoomInfo: null,
    currentRoom: null,
    isConnected: false,
    isConnecting: false,
    isTalking: false,
  };

  const defaultBluetoothState = {
    selectedAudioDevices: mockSelectedAudioDevices,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLiveKitStore.mockReturnValue(defaultLiveKitState);
    mockUseBluetoothAudioStore.mockReturnValue(defaultBluetoothState);
  });

  describe('Component Rendering', () => {
    it('should render successfully when bottom sheet is not visible', () => {
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: false,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
    });

    it('should render successfully when bottom sheet is visible', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        availableRooms: mockAvailableRooms,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });

    it('should render successfully when connecting', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnecting: true,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });

    it('should render successfully when connected', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: mockRoom,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });
  });

  describe('Store Interactions', () => {
    it('should call fetchVoiceSettings when opening room selection view', () => {
      const mockFetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        fetchVoiceSettings: mockFetchVoiceSettings,
      });

      render(<LiveKitBottomSheet />);
      expect(mockFetchVoiceSettings).toHaveBeenCalled();
    });

    it('should handle empty rooms list', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        availableRooms: [],
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });

    it('should handle connected state with room info', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: mockRoom,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });

    it('should handle talking state', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: mockRoom,
        isTalking: true,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });
  });

  describe('Audio Device State', () => {
    it('should handle missing microphone device', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: mockRoom,
        fetchVoiceSettings,
      });

      mockUseBluetoothAudioStore.mockReturnValue({
        selectedAudioDevices: {
          microphone: null,
          speaker: mockSelectedAudioDevices.speaker,
        },
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
    });

    it('should handle missing speaker device', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: mockRoom,
        fetchVoiceSettings,
      });

      mockUseBluetoothAudioStore.mockReturnValue({
        selectedAudioDevices: {
          microphone: mockSelectedAudioDevices.microphone,
          speaker: null,
        },
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing currentRoom gracefully', () => {
      const fetchVoiceSettings = jest.fn();
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: null,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
    });

    it('should handle missing localParticipant gracefully', () => {
      const fetchVoiceSettings = jest.fn();
      const roomWithoutParticipant = {
        localParticipant: null,
      };

      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: roomWithoutParticipant,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
    });

    it('should handle empty room name gracefully', () => {
      const fetchVoiceSettings = jest.fn();
      const roomInfoWithoutName = {
        ...mockCurrentRoomInfo,
        Name: '',
      };

      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: roomInfoWithoutName,
        currentRoom: mockRoom,
        fetchVoiceSettings,
      });

      const component = render(<LiveKitBottomSheet />);
      expect(component).toBeTruthy();
    });
  });

  describe('Component State Management', () => {
    it('should handle view transitions', () => {
      const fetchVoiceSettings = jest.fn();

      // Start with room selection
      const { rerender } = render(<LiveKitBottomSheet />);
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        availableRooms: mockAvailableRooms,
        fetchVoiceSettings,
      });

      rerender(<LiveKitBottomSheet />);
      expect(fetchVoiceSettings).toHaveBeenCalled();

      // Connect to room
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: mockRoom,
        fetchVoiceSettings,
      });

      rerender(<LiveKitBottomSheet />);
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });

    it('should handle microphone state changes', () => {
      const fetchVoiceSettings = jest.fn();

      // Start with muted microphone
      const { rerender } = render(<LiveKitBottomSheet />);
      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: mockRoom,
        fetchVoiceSettings,
      });

      rerender(<LiveKitBottomSheet />);

      // Enable microphone
      const enabledMockRoom = {
        localParticipant: {
          isMicrophoneEnabled: true,
          setMicrophoneEnabled: jest.fn(),
        },
      };

      mockUseLiveKitStore.mockReturnValue({
        ...defaultLiveKitState,
        isBottomSheetVisible: true,
        isConnected: true,
        currentRoomInfo: mockCurrentRoomInfo,
        currentRoom: enabledMockRoom,
        fetchVoiceSettings,
      });

      rerender(<LiveKitBottomSheet />);
      expect(fetchVoiceSettings).toHaveBeenCalled();
    });
  });
}); 