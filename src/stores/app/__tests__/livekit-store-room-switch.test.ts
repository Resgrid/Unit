import notifee from '@notifee/react-native';
import { Room, RoomEvent } from 'livekit-client';

import { DepartmentVoiceChannelResultData } from '@/models/v4/voice/departmentVoiceResultData';
import { callKeepService } from '@/services/callkeep.service';

import { useLiveKitStore } from '../livekit-store';

jest.mock('@livekit/react-native', () => ({
  AudioSession: {
    startAudioSession: jest.fn(),
    stopAudioSession: jest.fn(),
  },
}));

jest.mock('@livekit/react-native-webrtc', () => ({
  RTCAudioSession: {},
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn(),
    stopForegroundService: jest.fn(),
  },
  AndroidForegroundServiceType: {
    FOREGROUND_SERVICE_TYPE_MICROPHONE: 1,
  },
  AndroidImportance: {
    DEFAULT: 3,
  },
}));

jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: jest.fn(),
  requestRecordingPermissionsAsync: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
  },
  InterruptionModeIOS: {
    MixWithOthers: 0,
  },
}));

jest.mock('expo-device', () => ({
  hasPlatformFeatureAsync: jest.fn(),
}));

jest.mock('livekit-client', () => ({
  Room: jest.fn(),
  RoomEvent: {
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    Disconnected: 'disconnected',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    Reconnected: 'reconnected',
    Reconnecting: 'reconnecting',
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn(),
  },
  NativeModules: {},
  PermissionsAndroid: {
    check: jest.fn(),
    request: jest.fn(),
    requestMultiple: jest.fn(),
    PERMISSIONS: {
      READ_PHONE_NUMBERS: 'android.permission.READ_PHONE_NUMBERS',
      READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    RESULTS: {
      DENIED: 'denied',
      GRANTED: 'granted',
    },
  },
  Platform: {
    OS: 'web',
  },
}));

jest.mock('@/api/voice', () => ({
  getCanConnectToVoiceSession: jest.fn(),
  getDepartmentVoiceSettings: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/services/audio.service', () => ({
  audioService: {
    playConnectToAudioRoomSound: jest.fn().mockResolvedValue(undefined),
    playDisconnectedFromAudioRoomSound: jest.fn().mockResolvedValue(undefined),
    playStartTransmittingSound: jest.fn().mockResolvedValue(undefined),
    playStopTransmittingSound: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/bluetooth-audio.service', () => ({
  bluetoothAudioService: {
    ensurePttInputMonitoring: jest.fn(),
  },
}));

jest.mock('@/services/callkeep.service', () => ({
  callKeepService: {
    endCall: jest.fn().mockResolvedValue(undefined),
    setEndCallCallback: jest.fn(),
    setMuteStateCallback: jest.fn(),
    startCall: jest.fn().mockResolvedValue('call-uuid'),
  },
}));

jest.mock('../bluetooth-audio-store', () => ({
  useBluetoothAudioStore: {
    getState: jest.fn(() => ({
      connectedDevice: null,
      selectedAudioDevices: {
        microphone: null,
        speaker: null,
      },
      setLastButtonAction: jest.fn(),
      setSelectedMicrophone: jest.fn(),
      setSelectedSpeaker: jest.fn(),
    })),
  },
}));

type RoomEventHandler = (...args: unknown[]) => void;

interface MockRoom {
  connect: jest.Mock;
  disconnect: jest.Mock;
  handlers: Map<string, RoomEventHandler>;
  localParticipant: {
    audioTracks: Map<unknown, unknown>;
    identity: string;
    isMicrophoneEnabled: boolean;
    setCameraEnabled: jest.Mock;
    setMicrophoneEnabled: jest.Mock;
    sid: string;
    videoTracks: Map<unknown, unknown>;
  };
  on: jest.Mock;
  remoteParticipants: Map<unknown, unknown>;
}

const createMockRoom = (identity: string): MockRoom => {
  const handlers = new Map<string, RoomEventHandler>();
  const room: MockRoom = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    handlers,
    localParticipant: {
      audioTracks: new Map(),
      identity,
      isMicrophoneEnabled: false,
      setCameraEnabled: jest.fn().mockResolvedValue(undefined),
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
      sid: `${identity}-sid`,
      videoTracks: new Map(),
    },
    on: jest.fn(),
    remoteParticipants: new Map(),
  };
  room.on.mockImplementation((event: string, handler: RoomEventHandler) => {
    handlers.set(event, handler);
    return room;
  });
  room.disconnect.mockImplementation(async () => {
    handlers.get(RoomEvent.Disconnected)?.();
  });
  return room;
};

const createRoomInfo = (id: string, name: string): DepartmentVoiceChannelResultData =>
  Object.assign(new DepartmentVoiceChannelResultData(), {
    Id: id,
    Name: name,
  });

describe('LiveKit store room switching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLiveKitStore.setState({
      currentRoom: null,
      currentRoomInfo: null,
      isConnected: false,
      isConnecting: false,
      isMicrophoneEnabled: false,
      isTalking: false,
      requestPermissions: jest.fn().mockResolvedValue(true),
      voipServerWebsocketSslAddress: 'wss://voice.example.com',
    });
  });

  it('marks the old room disconnected before switching rooms', async () => {
    const oldRoom = createMockRoom('old-participant');
    const newRoom = createMockRoom('new-participant');
    const mockedRoomConstructor = Room as unknown as jest.Mock;
    mockedRoomConstructor.mockImplementationOnce(() => oldRoom).mockImplementationOnce(() => newRoom);

    await useLiveKitStore.getState().connectToRoom(createRoomInfo('old', 'Old Room'), 'old-token');
    expect(useLiveKitStore.getState().currentRoom).toBe(oldRoom);

    let connectedStateDuringOldRoomDisconnect: boolean | undefined;
    oldRoom.disconnect.mockImplementation(async () => {
      connectedStateDuringOldRoomDisconnect = useLiveKitStore.getState().isConnected;
      oldRoom.handlers.get(RoomEvent.Disconnected)?.();
    });

    useLiveKitStore.setState({
      isConnected: false,
      requestPermissions: jest.fn().mockImplementation(async () => {
        // Simulate a concurrent state update after the entry guard but before
        // the old room is intentionally disconnected.
        useLiveKitStore.setState({ isConnected: true });
        return true;
      }),
    });
    jest.mocked(callKeepService.endCall).mockClear();
    jest.mocked(notifee.stopForegroundService).mockClear();

    await useLiveKitStore.getState().connectToRoom(createRoomInfo('new', 'New Room'), 'new-token');

    expect(connectedStateDuringOldRoomDisconnect).toBe(false);
    expect(callKeepService.endCall).not.toHaveBeenCalled();
    expect(notifee.stopForegroundService).not.toHaveBeenCalled();
    expect(useLiveKitStore.getState()).toMatchObject({
      currentRoom: newRoom,
      isConnected: true,
    });
  });
});
