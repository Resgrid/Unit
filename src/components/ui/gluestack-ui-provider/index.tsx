import { OverlayProvider } from '@gluestack-ui/overlay';
import { ToastProvider } from '@gluestack-ui/toast';
import React from 'react';
import { useColorScheme, View, type ViewProps } from 'react-native';

import { config } from './config';

export function GluestackUIProvider({ mode = 'light', ...props }: { mode?: 'light' | 'dark' | 'system'; children?: React.ReactNode; style?: ViewProps['style'] }) {
  // Use react-native's useColorScheme which reads the OS preference.
  // With darkMode: 'media', nativewind handles dark styling via CSS media queries,
  // so we only need the OS value to pick the right gluestack CSS-variable config.
  const osScheme = useColorScheme();
  const colorSchemeName: 'light' | 'dark' = mode === 'system' ? (osScheme === 'dark' ? 'dark' : 'light') : (mode === 'dark' ? 'dark' : 'light');

  return (
    <View style={[config[colorSchemeName], { flex: 1, height: '100%', width: '100%' }, props.style]}>
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
