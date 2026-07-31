import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { toDomProps } from '@/components/ui/utils/dom-props';

import { cardStyle } from './styles';

type ICardProps = React.ComponentPropsWithoutRef<'div'> & VariantProps<typeof cardStyle> & { style?: StyleProp<ViewStyle>; testID?: string };

const Card = React.forwardRef<HTMLDivElement, ICardProps>(({ className, size = 'md', variant = 'elevated', style, ...props }, ref) => {
  const flatStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  return <div className={cardStyle({ size, variant, class: className })} style={flatStyle as React.CSSProperties} {...toDomProps(props)} ref={ref} />;
});

Card.displayName = 'Card';

export { Card };
