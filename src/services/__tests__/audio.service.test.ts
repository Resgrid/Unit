import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

import * as Notifications from 'expo-notifications';
import { audioService } from '../audio.service';

describe('AudioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should play connection sound', async () => {
    const scheduleNotificationSpy = jest.spyOn(Notifications, 'scheduleNotificationAsync');

    await audioService.playConnectionSound();

    expect(scheduleNotificationSpy).toHaveBeenCalledWith({
      content: {
        title: '',
        body: '',
        sound: 'space_notification1',
        badge: 0,
      },
      trigger: null,
    });
  });

  it('should play disconnection sound', async () => {
    const scheduleNotificationSpy = jest.spyOn(Notifications, 'scheduleNotificationAsync');

    await audioService.playDisconnectionSound();

    expect(scheduleNotificationSpy).toHaveBeenCalledWith({
      content: {
        title: '',
        body: '',
        sound: 'space_notification2',
        badge: 0,
      },
      trigger: null,
    });
  });

  it('should handle cleanup without errors', async () => {
    await expect(audioService.cleanup()).resolves.not.toThrow();
  });
});
