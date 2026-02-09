import { colorScheme, useColorScheme } from 'nativewind';
import React from 'react';
import { Platform } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';

import { storage } from '../storage';

const SELECTED_THEME = 'SELECTED_THEME';
export type ColorSchemeType = 'light' | 'dark' | 'system';
/**
 * this hooks should only be used while selecting the theme
 * This hooks will return the selected theme which is stored in MMKV
 * selectedTheme should be one of the following values 'light', 'dark' or 'system'
 * don't use this hooks if you want to use it to style your component based on the theme use useColorScheme from nativewind instead
 *
 */
export const useSelectedTheme = () => {
  const { colorScheme: _color, setColorScheme } = useColorScheme();
  const [theme, _setTheme] = useMMKVString(SELECTED_THEME, storage);

  const setSelectedTheme = React.useCallback(
    (t: ColorSchemeType) => {
      // On web with darkMode: 'media', nativewind's colorScheme.set() throws
      // because manual override is not supported. Only persist the preference.
      if (Platform.OS !== 'web') {
        setColorScheme(t);
      }
      _setTheme(t);
    },
    [setColorScheme, _setTheme]
  );

  const selectedTheme = (theme ?? 'system') as ColorSchemeType;
  return { selectedTheme, setSelectedTheme } as const;
};
// to be used in the root file to load the selected theme from MMKV
export const loadSelectedTheme = () => {
  // On web with darkMode: 'media', the browser handles dark mode via CSS media
  // queries. Calling colorScheme.set() would throw because manual override is
  // not supported in media-query mode.
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const theme = storage.getString(SELECTED_THEME);
    if (theme !== undefined) {
      console.log('Loading selected theme:', theme);
      colorScheme.set(theme as ColorSchemeType);
    } else {
      console.log('No custom theme found, using system default');
    }
  } catch (error) {
    console.error('Failed to load selected theme:', error);
  }
};
