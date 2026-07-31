import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { toDomProps } from '@/components/ui/utils/dom-props';

import { vstackStyle } from './styles';

type IVStackProps = React.ComponentProps<'div'> & VariantProps<typeof vstackStyle> & { style?: StyleProp<ViewStyle>; testID?: string };

const VStack = React.forwardRef<React.ComponentRef<'div'>, IVStackProps>(function VStack({ className, space, reversed, style, ...props }, ref) {
  const flatStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  return <div className={vstackStyle({ space, reversed, class: className })} style={flatStyle as React.CSSProperties} {...toDomProps(props)} ref={ref} />;
});

VStack.displayName = 'VStack';

export { VStack };
