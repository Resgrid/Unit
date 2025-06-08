import { useIsFocused } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform, StatusBar } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

type Props = { hidden?: boolean };
export const FocusAwareStatusBar = ({ hidden = false }: Props) => {
  const isFocused = useIsFocused();
  const { colorScheme } = useColorScheme();

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      // Make both status bar and navigation bar transparent
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);

      // Set the system UI flags to hide navigation bar
      if (hidden) {
        StatusBar.setHidden(true, 'slide');
        // Set light status bar content for better visibility
        StatusBar.setBarStyle('light-content');
      } else {
        StatusBar.setHidden(false, 'slide');
        // Adapt status bar content based on theme
        StatusBar.setBarStyle(colorScheme === 'dark' ? 'light-content' : 'dark-content');
      }
    }
  }, [hidden, colorScheme]);

  if (Platform.OS === 'web') return null;

  return isFocused ? <SystemBars style={colorScheme} hidden={hidden} /> : null;
};
