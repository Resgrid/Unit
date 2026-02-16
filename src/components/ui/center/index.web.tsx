import type { VariantProps } from '@gluestack-ui/nativewind-utils';
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { centerStyle } from './styles';

type ICenterProps = React.ComponentPropsWithoutRef<'div'> & VariantProps<typeof centerStyle> & { style?: StyleProp<ViewStyle> };

const Center = React.forwardRef<HTMLDivElement, ICenterProps>(({ className, style, ...props }, ref) => {
  const flatStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  return <div className={centerStyle({ class: className })} style={flatStyle} {...props} ref={ref} />;
});

Center.displayName = 'Center';

export { Center };
