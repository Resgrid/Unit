import { useIsFocused } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform, StatusBar } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

type Props = { hidden?: boolean };
export const FocusAwareStatusBar = ({ hidden = false }: Props) => {
  const isFocused = useIsFocused();
  const { colorScheme } = useColorScheme();

  React.useEffect(() => {
    // Only call platform-specific methods when they are supported
    if (Platform.OS === 'android') {
      try {
        // Make both status bar and navigation bar transparent
        StatusBar.setBackgroundColor('transparent');
        StatusBar.setTranslucent(true);

        // Hide navigation bar only on Android
        NavigationBar.setVisibilityAsync('hidden').catch(() => {
          // Silently handle errors if NavigationBar API is not available
        });

        // Set the system UI flags to hide navigation bar
        if (hidden) {
          StatusBar.setHidden(true, 'slide');
        } else {
          StatusBar.setHidden(false, 'slide');
        }

        // Adapt status bar content based on theme
        StatusBar.setBarStyle(colorScheme === 'dark' ? 'light-content' : 'dark-content');
      } catch (error) {
        // Silently handle errors if StatusBar methods are not available
      }
    } else if (Platform.OS === 'ios') {
      try {
        // iOS-specific status bar configuration
        if (hidden) {
          StatusBar.setHidden(true, 'slide');
        } else {
          StatusBar.setHidden(false, 'slide');
        }

        // Set status bar style for iOS
        StatusBar.setBarStyle(colorScheme === 'dark' ? 'light-content' : 'dark-content');
      } catch (error) {
        // Silently handle errors if StatusBar methods are not available
      }
    }
  }, [hidden, colorScheme]);

  // Don't render anything on web
  if (Platform.OS === 'web') return null;

  // Only render SystemBars when focused and on supported platforms
  return isFocused && (Platform.OS === 'android' || Platform.OS === 'ios') ? <SystemBars style={colorScheme} hidden={{ statusBar: hidden, navigationBar: true }} /> : null;
};
