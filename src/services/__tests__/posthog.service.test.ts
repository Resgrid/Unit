import { postHogService } from '../posthog.service';
import { logger } from '@/lib/logging';

// Mock the logger
jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('PostHogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    postHogService.reset();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('handleNetworkError', () => {
    it('should log network errors', () => {
      const error = new Error('Network error');

      postHogService.handleNetworkError(error);

      expect(logger.error).toHaveBeenCalledWith({
        message: 'PostHog network error',
        context: {
          error: 'Network error',
          retryCount: 1,
          isDisabled: false,
        },
      });
    });

    it('should disable PostHog after max retries', () => {
      const error = new Error('Network error');

      // Trigger errors up to max retries
      postHogService.handleNetworkError(error);
      postHogService.handleNetworkError(error);
      postHogService.handleNetworkError(error);

      expect(postHogService.isPostHogDisabled()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith({
        message: 'PostHog temporarily disabled due to network errors',
        context: { retryCount: 3 },
      });
    });

    it('should re-enable PostHog after timeout', () => {
      const error = new Error('Network error');

      // Trigger enough errors to disable
      postHogService.handleNetworkError(error);
      postHogService.handleNetworkError(error);
      postHogService.handleNetworkError(error);

      expect(postHogService.isPostHogDisabled()).toBe(true);

      // Fast forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(postHogService.isPostHogDisabled()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith({
        message: 'PostHog re-enabled after network recovery',
      });
    });
  });

  describe('handleNavigationError', () => {
    it('should log navigation errors only once', () => {
      const error = new Error('Navigation state error');

      postHogService.handleNavigationError(error);

      expect(logger.warn).toHaveBeenCalledWith({
        message: 'PostHog navigation state errors suppressed',
        context: {
          error: 'Navigation state error',
          note: 'Navigation tracking has been disabled to prevent errors',
        },
      });
    });

    it('should not log duplicate navigation errors', () => {
      const error = new Error('Navigation state error');

      postHogService.handleNavigationError(error);
      postHogService.handleNavigationError(error);

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should update navigation errors suppressed status', () => {
      const error = new Error('Navigation state error');

      expect(postHogService.areNavigationErrorsSuppressed()).toBe(false);

      postHogService.handleNavigationError(error);

      expect(postHogService.areNavigationErrorsSuppressed()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = postHogService.getStatus();

      expect(status).toEqual({
        retryCount: 0,
        isDisabled: false,
        navigationErrorsSuppressed: false,
      });
    });

    it('should return updated status after errors', () => {
      const error = new Error('Network error');
      postHogService.handleNetworkError(error);

      const status = postHogService.getStatus();

      expect(status).toEqual({
        retryCount: 1,
        isDisabled: false,
        navigationErrorsSuppressed: false,
      });
    });

    it('should return updated status after navigation errors', () => {
      const error = new Error('Navigation state error');
      postHogService.handleNavigationError(error);

      const status = postHogService.getStatus();

      expect(status).toEqual({
        retryCount: 0,
        isDisabled: false,
        navigationErrorsSuppressed: true,
      });
    });
  });

  describe('reset', () => {
    it('should reset service state', () => {
      const error = new Error('Network error');
      const navError = new Error('Navigation state error');

      postHogService.handleNetworkError(error);
      postHogService.handleNavigationError(navError);

      expect(postHogService.getStatus().retryCount).toBe(1);
      expect(postHogService.areNavigationErrorsSuppressed()).toBe(true);

      postHogService.reset();

      expect(postHogService.getStatus()).toEqual({
        retryCount: 0,
        isDisabled: false,
        navigationErrorsSuppressed: false,
      });
    });
  });

  describe('isPostHogDisabled', () => {
    it('should return false initially', () => {
      expect(postHogService.isPostHogDisabled()).toBe(false);
    });

    it('should return true after max retries', () => {
      const error = new Error('Network error');

      postHogService.handleNetworkError(error);
      postHogService.handleNetworkError(error);
      postHogService.handleNetworkError(error);

      expect(postHogService.isPostHogDisabled()).toBe(true);
    });
  });

  describe('areNavigationErrorsSuppressed', () => {
    it('should return false initially', () => {
      expect(postHogService.areNavigationErrorsSuppressed()).toBe(false);
    });

    it('should return true after navigation error', () => {
      const error = new Error('Navigation state error');

      postHogService.handleNavigationError(error);

      expect(postHogService.areNavigationErrorsSuppressed()).toBe(true);
    });
  });
});
