// Mock for @livekit/react-native-webrtc
export const RTCAudioSession = {
  configure: jest.fn().mockResolvedValue(undefined),
  setCategory: jest.fn().mockResolvedValue(undefined),
  setMode: jest.fn().mockResolvedValue(undefined),
  getActiveAudioSession: jest.fn().mockReturnValue(null),
  setActive: jest.fn().mockResolvedValue(undefined),
};

export default {
  RTCAudioSession,
};
