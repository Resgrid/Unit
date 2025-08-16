export default {
  setup: jest.fn().mockResolvedValue(undefined),
  startCall: jest.fn().mockResolvedValue(undefined),
  reportConnectingOutgoingCallWithUUID: jest.fn().mockResolvedValue(undefined),
  reportConnectedOutgoingCallWithUUID: jest.fn().mockResolvedValue(undefined),
  endCall: jest.fn().mockResolvedValue(undefined),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  answerIncomingCall: jest.fn(),
  rejectCall: jest.fn(),
  setCurrentCallActive: jest.fn(),
  backToForeground: jest.fn(),
};

export const AudioSessionCategoryOption = {};
export const AudioSessionMode = {};
export const CONSTANTS = {};
