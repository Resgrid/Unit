import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { toDomProps } from '@/components/ui/utils/dom-props';

import { centerStyle } from './styles';

type ICenterProps = React.ComponentPropsWithoutRef<'div'> & VariantProps<typeof centerStyle> & { style?: StyleProp<ViewStyle>; testID?: string };

const Center = React.forwardRef<HTMLDivElement, ICenterProps>(({ className, style, ...props }, ref) => {
  const flatStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  return <div className={centerStyle({ class: className })} style={flatStyle as React.CSSProperties} {...toDomProps(props)} ref={ref} />;
});

Center.displayName = 'Center';

export { Center };
