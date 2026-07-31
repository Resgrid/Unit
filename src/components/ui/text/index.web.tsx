import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';

import { toDomProps } from '@/components/ui/utils/dom-props';

import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> & VariantProps<typeof textStyle> & { testID?: string };

const Text = React.forwardRef<React.ElementRef<'span'>, ITextProps>(
  ({ className, isTruncated, bold, underline, strikeThrough, size = 'md', sub, italic, highlight, ...props }: { className?: string } & ITextProps, ref) => {
    return (
      <span
        className={textStyle({
          isTruncated,
          bold,
          underline,
          strikeThrough,
          size,
          sub,
          italic,
          highlight,
          class: className,
        })}
        {...toDomProps(props)}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
