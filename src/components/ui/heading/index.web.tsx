import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React, { forwardRef, memo } from 'react';

import { toDomProps } from '@/components/ui/utils/dom-props';

import { headingStyle } from './styles';
type IHeadingProps = VariantProps<typeof headingStyle> &
  React.ComponentPropsWithoutRef<'h1'> & {
    as?: React.ElementType;
    testID?: string;
  };

const MappedHeading = memo(
  forwardRef<HTMLHeadingElement, IHeadingProps>(function MappedHeading({ size, className, isTruncated, bold, underline, strikeThrough, sub, italic, highlight, ...props }, ref) {
    const domProps = toDomProps(props);
    switch (size) {
      case '5xl':
      case '4xl':
      case '3xl':
        return (
          <h1
            className={headingStyle({
              size,
              isTruncated,
              bold,
              underline,
              strikeThrough,
              sub,
              italic,
              highlight,
              class: className,
            })}
            {...domProps}
            ref={ref}
          />
        );
      case '2xl':
        return (
          <h2
            className={headingStyle({
              size,
              isTruncated,
              bold,
              underline,
              strikeThrough,
              sub,
              italic,
              highlight,
              class: className,
            })}
            {...domProps}
            ref={ref}
          />
        );
      case 'xl':
        return (
          <h3
            className={headingStyle({
              size,
              isTruncated,
              bold,
              underline,
              strikeThrough,
              sub,
              italic,
              highlight,
              class: className,
            })}
            {...domProps}
            ref={ref}
          />
        );
      case 'lg':
        return (
          <h4
            className={headingStyle({
              size,
              isTruncated,
              bold,
              underline,
              strikeThrough,
              sub,
              italic,
              highlight,
              class: className,
            })}
            {...domProps}
            ref={ref}
          />
        );
      case 'md':
        return (
          <h5
            className={headingStyle({
              size,
              isTruncated,
              bold,
              underline,
              strikeThrough,
              sub,
              italic,
              highlight,
              class: className,
            })}
            {...domProps}
            ref={ref}
          />
        );
      case 'sm':
      case 'xs':
        return (
          <h6
            className={headingStyle({
              size,
              isTruncated,
              bold,
              underline,
              strikeThrough,
              sub,
              italic,
              highlight,
              class: className,
            })}
            {...domProps}
            ref={ref}
          />
        );
      default:
        return (
          <h4
            className={headingStyle({
              size,
              isTruncated,
              bold,
              underline,
              strikeThrough,
              sub,
              italic,
              highlight,
              class: className,
            })}
            {...domProps}
            ref={ref}
          />
        );
    }
  })
);

const Heading = memo(
  forwardRef<HTMLHeadingElement, IHeadingProps>(function Heading({ className, size = 'lg', as: AsComp, ...props }, ref) {
    const { isTruncated, bold, underline, strikeThrough, sub, italic, highlight } = props;

    if (AsComp) {
      return (
        <AsComp
          className={headingStyle({
            size,
            isTruncated,
            bold,
            underline,
            strikeThrough,
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

    return <MappedHeading className={className} size={size} ref={ref} {...props} />;
  })
);

Heading.displayName = 'Heading';

export { Heading };
