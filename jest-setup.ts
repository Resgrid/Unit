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
