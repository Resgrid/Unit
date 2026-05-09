import { NativeModules, Platform } from 'react-native';

const { CheckInTimerActivityManager } = NativeModules;

interface CheckInLiveActivityParams {
  callName: string;
  callNumber: string;
  timerName: string;
  durationMinutes: number;
}

export const checkInLiveActivity = {
  start: async (params: CheckInLiveActivityParams): Promise<boolean> => {
    if (Platform.OS !== 'ios' || !CheckInTimerActivityManager) {
      return false;
    }
    try {
      return await CheckInTimerActivityManager.startActivity(params.callName, params.callNumber, params.timerName, params.durationMinutes);
    } catch {
      return false;
    }
  },

  update: async (elapsedMinutes: number, status: string): Promise<boolean> => {
    if (Platform.OS !== 'ios' || !CheckInTimerActivityManager) {
      return false;
    }
    try {
      return await CheckInTimerActivityManager.updateActivity(elapsedMinutes, status);
    } catch {
      return false;
    }
  },

  end: async (): Promise<boolean> => {
    if (Platform.OS !== 'ios' || !CheckInTimerActivityManager) {
      return false;
    }
    try {
      return await CheckInTimerActivityManager.endActivity();
    } catch {
      return false;
    }
  },
};
