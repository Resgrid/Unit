import React from 'react';
import { Platform } from 'react-native';
import { useMMKVBoolean } from 'react-native-mmkv';

import { storage } from '@/lib/storage';
import { MODERN_NOTIFICATION_SOUNDS_ENABLED } from '@/lib/storage/notification-prefs';
import { pushNotificationService } from '@/services/push-notification';

/**
 * Android-only hook for the "use modern notification sounds" preference.
 *
 * Defaults to enabled (modern sounds) and is persisted in MMKV alongside the
 * other app settings. When toggled on Android, the notification channels are
 * recreated so the new sound takes effect — a channel's sound is immutable
 * after it is created, so it must be deleted and recreated to change it.
 */
export const useModernNotificationSounds = () => {
  const [enabled, _setEnabled] = useMMKVBoolean(MODERN_NOTIFICATION_SOUNDS_ENABLED, storage);

  const setModernSoundsEnabled = React.useCallback(
    async (value: boolean) => {
      _setEnabled(value);
      if (Platform.OS === 'android') {
        await pushNotificationService.refreshAndroidNotificationChannels();
      }
    },
    [_setEnabled]
  );

  // Default ON when the user has not set a preference.
  const isModernSoundsEnabled = enabled ?? true;
  return { isModernSoundsEnabled, setModernSoundsEnabled } as const;
};
