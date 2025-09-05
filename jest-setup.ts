import '@testing-library/react-native/extend-expect';

// react-hook form setup for testing
// @ts-ignore
global.window = {};
// @ts-ignore
global.window = global;

// Mock expo-audio globally
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn(),
    playing: false,
    paused: false,
    isLoaded: true,
    duration: 0,
    currentTime: 0,
    volume: 1,
    muted: false,
    loop: false,
    playbackRate: 1,
    id: 1,
    isAudioSamplingSupported: false,
    isBuffering: false,
    shouldCorrectPitch: false,
  })),
  useAudioPlayer: jest.fn(),
  useAudioPlayerStatus: jest.fn(),
  setAudioModeAsync: jest.fn(),
  setIsAudioActiveAsync: jest.fn(),
}));

// Mock the host component names function to prevent testing library errors
jest.mock('@testing-library/react-native/build/helpers/host-component-names', () => ({
  getHostComponentNames: jest.fn(() => ({
    text: 'Text',
    view: 'View',
    scrollView: 'ScrollView',
    touchable: 'TouchableOpacity',
    switch: 'Switch',
    textInput: 'TextInput',
  })),
  configureHostComponentNamesIfNeeded: jest.fn(),
  isHostText: jest.fn((element) => element?.type === 'Text' || element?._fiber?.type === 'Text' || (typeof element === 'object' && element?.props?.children && typeof element.props.children === 'string')),
  isHostTextInput: jest.fn((element) => element?.type === 'TextInput' || element?._fiber?.type === 'TextInput'),
  isHostImage: jest.fn((element) => element?.type === 'Image' || element?._fiber?.type === 'Image'),
  isHostSwitch: jest.fn((element) => element?.type === 'Switch' || element?._fiber?.type === 'Switch'),
  isHostScrollView: jest.fn((element) => element?.type === 'ScrollView' || element?._fiber?.type === 'ScrollView'),
  isHostModal: jest.fn((element) => element?.type === 'Modal' || element?._fiber?.type === 'Modal'),
}));

// Global mocks for common problematic modules
jest.mock('@notifee/react-native', () => {
  const mockNotifee = {
    createChannel: jest.fn().mockResolvedValue('mock-channel-id'),
    displayNotification: jest.fn().mockResolvedValue('mock-notification-id'),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getPermissionSettings: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    setBadgeCount: jest.fn().mockResolvedValue(undefined),
    decrementBadgeCount: jest.fn().mockResolvedValue(undefined),
    incrementBadgeCount: jest.fn().mockResolvedValue(undefined),
    getBadgeCount: jest.fn().mockResolvedValue(0),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
    onForegroundEvent: jest.fn(),
    onBackgroundEvent: jest.fn(),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    getDisplayedNotifications: jest.fn().mockResolvedValue([]),
    getTriggerNotifications: jest.fn().mockResolvedValue([]),
    openBatteryOptimizationSettings: jest.fn().mockResolvedValue(undefined),
    openNotificationSettings: jest.fn().mockResolvedValue(undefined),
    openPowerManagerSettings: jest.fn().mockResolvedValue(undefined),
    getPowerManagerInfo: jest.fn().mockResolvedValue({}),
    isBatteryOptimizationEnabled: jest.fn().mockResolvedValue(false),
    registerForegroundService: jest.fn().mockResolvedValue(undefined),
    stopForegroundService: jest.fn().mockResolvedValue(undefined),
  };

  const AndroidImportance = {
    DEFAULT: 'default',
    HIGH: 'high',
    LOW: 'low',
    MIN: 'min',
    NONE: 'none',
    UNSPECIFIED: 'unspecified',
  };

  return {
    __esModule: true,
    default: mockNotifee,
    AndroidImportance,
  };
});

jest.mock('livekit-client', () => ({
  Room: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    localParticipant: {
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
    },
    participants: new Map(),
    state: 'disconnected',
    name: 'test-room',
  })),
  RoomEvent: {
    Connected: 'connected',
    Disconnected: 'disconnected',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
  },
  ConnectionState: {
    Connected: 'connected',
    Connecting: 'connecting',
    Disconnected: 'disconnected',
    Reconnecting: 'reconnecting',
  },
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      CAMERA: 'android.permission.CAMERA',
    },
    IOS: {
      MICROPHONE: 'ios.permission.MICROPHONE',
      CAMERA: 'ios.permission.CAMERA',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    LIMITED: 'limited',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
  },
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  requestMultiple: jest.fn().mockResolvedValue({}),
  openSettings: jest.fn().mockResolvedValue(undefined),
  checkNotifications: jest.fn().mockResolvedValue({
    status: 'granted',
    settings: {},
  }),
  requestNotifications: jest.fn().mockResolvedValue({
    status: 'granted',
    settings: {},
  }),
}));

// Mock nativewind to avoid react-native-css-interop issues
jest.mock('nativewind', () => ({
  cssInterop: jest.fn((Component: any) => Component),
  useColorScheme: jest.fn(() => ({
    colorScheme: 'light',
    get: jest.fn(() => 'light'),
  })),
  __esModule: true,
}));

// Mock zod globally to avoid validation schema issues in tests
jest.mock('zod', () => ({
  z: {
    object: jest.fn(() => ({
      parse: jest.fn((data) => data),
      safeParse: jest.fn((data) => ({ success: true, data })),
    })),
    string: jest.fn(() => ({
      min: jest.fn(() => ({
        parse: jest.fn((data) => data),
        safeParse: jest.fn((data) => ({ success: true, data })),
      })),
      parse: jest.fn((data) => data),
      safeParse: jest.fn((data) => ({ success: true, data })),
    })),
  },
  __esModule: true,
}));
