import { storage } from '@/lib/storage';

/**
 * MMKV key for the Android-only "use modern notification sounds" preference.
 * Defaults to enabled (modern sounds) when the user has not set a preference.
 */
export const MODERN_NOTIFICATION_SOUNDS_ENABLED = 'MODERN_NOTIFICATION_SOUNDS_ENABLED';

/**
 * MMKV key tracking which sound set the Android notification channels were last
 * created with. Android notification channel sound is immutable after creation,
 * so this marker lets us detect when channels need to be deleted and recreated.
 */
const NOTIFICATION_SOUND_MODE_APPLIED = 'NOTIFICATION_SOUND_MODE_APPLIED';

export type NotificationSoundMode = 'modern' | 'classic';

/**
 * Whether modern notification sounds are enabled. Defaults to true (modern is
 * the default) when the user has not made a choice.
 */
export const getModernNotificationSoundsEnabled = (): boolean => storage.getBoolean(MODERN_NOTIFICATION_SOUNDS_ENABLED) ?? true;

/**
 * The sound mode the Android channels were last created with, or undefined if
 * they have never been created (fresh install or app upgrade).
 */
export const getAppliedNotificationSoundMode = (): NotificationSoundMode | undefined => {
  const mode = storage.getString(NOTIFICATION_SOUND_MODE_APPLIED);
  return mode === 'modern' || mode === 'classic' ? mode : undefined;
};

/** Persist the sound mode the Android channels were created with. */
export const setAppliedNotificationSoundMode = (mode: NotificationSoundMode): void => {
  storage.set(NOTIFICATION_SOUND_MODE_APPLIED, mode);
};
