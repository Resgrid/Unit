/**
 * Mock for Countly React Native SDK
 * Used during testing to prevent actual analytics calls
 */

const mockCountly = {
  init: jest.fn().mockResolvedValue(undefined),
  start: jest.fn().mockResolvedValue(undefined),
  enableCrashReporting: jest.fn().mockResolvedValue(undefined),
  events: {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  },
};

export default mockCountly;
