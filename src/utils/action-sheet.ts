import { ActionSheetIOS, Platform } from 'react-native';

/**
 * Check if the current platform is iOS.
 * Extracted so it can be easily mocked in tests.
 */
export function isIOS(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Thin wrapper around ActionSheetIOS.showActionSheetWithOptions.
 * Extracted so it can be easily mocked in tests without requiring
 * the native ActionSheetManager module.
 */
export function showNativeActionSheet(options: { options: string[]; cancelButtonIndex?: number }, callback: (buttonIndex: number) => void): void {
  ActionSheetIOS.showActionSheetWithOptions(options, callback);
}
