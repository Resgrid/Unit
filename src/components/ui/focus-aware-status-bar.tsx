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
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }
  }, []);

  if (Platform.OS === 'web') return null;

  return isFocused ? <SystemBars style={colorScheme} hidden={hidden} /> : null;
};
