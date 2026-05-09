import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const liveActivityStarted = useRef(false);
  const prevCallId = useRef<string | undefined>(undefined);

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
      prevCallId.current = undefined;
      return;
    }

    const urgentTimer = timerStatuses[0];
    const secondsRemaining = Math.max(0, (urgentTimer.DurationMinutes - urgentTimer.ElapsedMinutes) * 60);

    // When the active call changes, tear down the previous activity/notification
    // before starting a fresh one for the new call.
    if (activeCall.CallId !== prevCallId.current && liveActivityStarted.current) {
      checkInLiveActivity.end();
      checkInNotificationService.stopNotification();
      liveActivityStarted.current = false;
    }

    if (Platform.OS === 'ios') {
      if (!liveActivityStarted.current) {
        checkInLiveActivity.start({
          callName: activeCall.Name,
          callNumber: activeCall.Number,
          timerName: urgentTimer.TargetName,
          durationMinutes: urgentTimer.DurationMinutes,
        });
        liveActivityStarted.current = true;
        prevCallId.current = activeCall.CallId;
      } else {
        checkInLiveActivity.update(Math.floor(urgentTimer.ElapsedMinutes), urgentTimer.Status);
      }
    }

    if (Platform.OS === 'android') {
      if (!liveActivityStarted.current) {
        checkInNotificationService.startNotification(activeCall.Name, activeCall.Number, urgentTimer.TargetName, secondsRemaining, urgentTimer.Status, {
          statusLabels: {
            Ok: t('check_in.status_ok'),
            Warning: t('check_in.status_warning'),
            Overdue: t('check_in.status_overdue'),
          },
          channelName: t('check_in.notification_channel_name'),
          channelDescription: t('check_in.notification_channel_description'),
          actionText: t('check_in.perform_check_in'),
        });
        liveActivityStarted.current = true;
        prevCallId.current = activeCall.CallId;
      } else {
        checkInNotificationService.updateNotification(secondsRemaining, urgentTimer.Status, {
          Ok: t('check_in.status_ok'),
          Warning: t('check_in.status_warning'),
          Overdue: t('check_in.status_overdue'),
        });
      }
    }
    // Deps are intentionally narrowed to the specific activeCall fields consumed
    // by this effect; listing the full `activeCall` object would cause spurious
    // reruns whenever any unrelated call property changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.CallId, activeCall?.Name, activeCall?.Number, timerStatuses, t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      checkInLiveActivity.end();
      checkInNotificationService.stopNotification();
    };
  }, []);
}
