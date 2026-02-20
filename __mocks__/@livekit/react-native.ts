// Mock for @livekit/react-native
export const AudioSession = {
  startAudioSession: jest.fn().mockResolvedValue(undefined),
  stopAudioSession: jest.fn().mockResolvedValue(undefined),
  configureAudio: jest.fn().mockResolvedValue(undefined),
  getAudioOutputs: jest.fn().mockResolvedValue([]),
  selectAudioOutput: jest.fn().mockResolvedValue(undefined),
  showAudioRoutePicker: jest.fn().mockResolvedValue(undefined),
  setAppleAudioConfiguration: jest.fn().mockResolvedValue(undefined),
};

export const registerGlobals = jest.fn();

export default {
  AudioSession,
  registerGlobals,
};
