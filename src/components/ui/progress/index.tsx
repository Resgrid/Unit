'use client';
import type { VariantProps } from '@gluestack-ui/nativewind-utils';
import { tva } from '@gluestack-ui/nativewind-utils/tva';
import { useStyleContext, withStyleContext } from '@gluestack-ui/nativewind-utils/withStyleContext';
import { createProgress } from '@gluestack-ui/progress';
import { cssInterop } from 'nativewind';
import React from 'react';
import { View } from 'react-native';
const SCOPE = 'PROGRESS';
export const UIProgress = createProgress({
  Root: withStyleContext(View, SCOPE),
  FilledTrack: View,
});

cssInterop(UIProgress, { className: 'style' });
cssInterop(UIProgress.FilledTrack, { className: 'style' });

const progressStyle = tva({
  base: 'bg-background-300 rounded-full w-full',
  variants: {
    size: {
      xs: 'h-1',
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4',
      xl: 'h-5',
      '2xl': 'h-6',
    },
  },
});
const progressFilledTrackStyle = tva({
  base: 'bg-primary-500 rounded-full',
  parentVariants: {
    size: {
      xs: 'h-1',
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4',
      xl: 'h-5',
      '2xl': 'h-6',
    },
  },
});

type IProgressProps = VariantProps<typeof progressStyle> & React.ComponentProps<typeof UIProgress>;
type IProgressFilledTrackProps = VariantProps<typeof progressFilledTrackStyle> & React.ComponentProps<typeof UIProgress.FilledTrack>;

export const Progress = React.forwardRef<React.ElementRef<typeof UIProgress>, IProgressProps>(({ className, size = 'md', ...props }, ref) => {
  return <UIProgress ref={ref} {...props} className={progressStyle({ size, class: className })} context={{ size }} />;
});

export const ProgressFilledTrack = React.forwardRef<React.ElementRef<typeof UIProgress.FilledTrack>, IProgressFilledTrackProps>(({ className, ...props }, ref) => {
  const { size: parentSize } = useStyleContext(SCOPE);

  return (
    <UIProgress.FilledTrack
      ref={ref}
      className={progressFilledTrackStyle({
        parentVariants: {
          size: parentSize,
        },
        class: className,
      })}
      {...props}
    />
  );
});
