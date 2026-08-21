import { aptabaseService, countlyService } from '../aptabase.service';

jest.mock('countly-sdk-react-native-bridge', () => ({
  __esModule: true,
  default: {
    events: {
      recordEvent: jest.fn(),
    },
  },
}));

jest.mock('../../lib/logging', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('aptabase service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    countlyService.reset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps the legacy aptabaseService alias pointing at the same instance', () => {
    expect(aptabaseService).toBe(countlyService);
  });

  it('resets the retry counter after a successful event', () => {
    const Countly = require('countly-sdk-react-native-bridge').default;

    Countly.events.recordEvent.mockImplementationOnce(() => {
      throw new Error('Network error');
    });
    countlyService.trackEvent('test_event');
    expect(countlyService.getStatus().retryCount).toBe(1);

    Countly.events.recordEvent.mockImplementation(() => undefined);
    countlyService.trackEvent('test_event');

    expect(countlyService.getStatus().retryCount).toBe(0);
  });

  it('does not disable analytics for isolated failures separated by successes', () => {
    const Countly = require('countly-sdk-react-native-bridge').default;

    for (let i = 0; i < 5; i += 1) {
      Countly.events.recordEvent.mockImplementationOnce(() => {
        throw new Error('Network error');
      });
      countlyService.trackEvent('test_event');

      Countly.events.recordEvent.mockImplementation(() => undefined);
      countlyService.trackEvent('test_event');
    }

    // Without the reset, two lifetime errors would have disabled analytics for
    // the full 10-minute window.
    expect(countlyService.isAnalyticsDisabled()).toBe(false);
  });

  it('still disables analytics after consecutive failures', () => {
    const Countly = require('countly-sdk-react-native-bridge').default;
    Countly.events.recordEvent.mockImplementation(() => {
      throw new Error('Network error');
    });

    countlyService.trackEvent('test_event');
    countlyService.trackEvent('test_event');

    expect(countlyService.isAnalyticsDisabled()).toBe(true);
  });
});
