import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { checkInLiveActivity } from '@/lib/native-modules/check-in-live-activity';
import { checkInNotificationService } from '@/services/check-in-notification.service';
import { useCoreStore } from '@/stores/app/core-store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';

export function useCheckInTimerPolling() {
  const activeCall = useCoreStore((state) => state.activeCall);
  const timerStatuses = useCheckInTimerStore((state) => state.timerStatuses);
  const startPolling = useCheckInTimerStore((state) => state.startPolling);
  const stopPolling = useCheckInTimerStore((state) => state.stopPolling);
  const liveActivityStarted = useRef(false);

  // Start/stop polling based on active call
  useEffect(() => {
    if (activeCall?.CheckInTimersEnabled) {
      startPolling(parseInt(activeCall.CallId, 10), 30000);
    } else {
      stopPolling();
    }
    return () => {
      stopPolling();
    };
  }, [activeCall?.CheckInTimersEnabled, activeCall?.CallId, startPolling, stopPolling]);

  // Update OS-level indicators when timer statuses change
  useEffect(() => {
    if (!activeCall || timerStatuses.length === 0) {
      // Clean up
      if (liveActivityStarted.current) {
        checkInLiveActivity.end();
        checkInNotificationService.stopNotification();
        liveActivityStarted.current = false;
      }
      return;
    }

    const urgentTimer = timerStatuses[0];
    const secondsRemaining = Math.max(0, (urgentTimer.DurationMinutes - urgentTimer.ElapsedMinutes) * 60);

    if (Platform.OS === 'ios') {
      if (!liveActivityStarted.current) {
        checkInLiveActivity.start({
          callName: activeCall.Name,
          callNumber: activeCall.Number,
          timerName: urgentTimer.TargetName,
          durationMinutes: urgentTimer.DurationMinutes,
        });
        liveActivityStarted.current = true;
      } else {
        checkInLiveActivity.update(Math.floor(urgentTimer.ElapsedMinutes), urgentTimer.Status);
      }
    }

    if (Platform.OS === 'android') {
      if (!liveActivityStarted.current) {
        checkInNotificationService.startNotification(activeCall.Name, activeCall.Number, urgentTimer.TargetName, secondsRemaining, urgentTimer.Status);
        liveActivityStarted.current = true;
      } else {
        checkInNotificationService.updateNotification(secondsRemaining, urgentTimer.Status);
      }
    }
  }, [activeCall, timerStatuses]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      checkInLiveActivity.end();
      checkInNotificationService.stopNotification();
    };
  }, []);
}
