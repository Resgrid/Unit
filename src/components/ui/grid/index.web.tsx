import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';

import { toDomProps } from '@/components/ui/utils/dom-props';

import { gridItemStyle, gridStyle } from './styles';

type IGridProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof gridStyle> & {
    testID?: string;
    gap?: number;
    rowGap?: number;
    columnGap?: number;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    padding?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingStart?: number;
    paddingEnd?: number;
    _extra: {
      className: string;
    };
  };

const Grid = React.forwardRef<HTMLDivElement, IGridProps>(function Grid({ className, _extra, ...props }, ref) {
  const gridClass = _extra?.className;
  const finalGridClass = gridClass ?? '';
  return (
    <div
      ref={ref}
      className={gridStyle({
        class: className + ' ' + finalGridClass,
      })}
      {...toDomProps(props)}
    />
  );
});

type IGridItemProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof gridItemStyle> & {
    index?: number;
    testID?: string;
    _extra: {
      className: string;
    };
  };
const GridItem = React.forwardRef<HTMLDivElement, IGridItemProps>(function GridItem({ className, _extra, ...props }, ref) {
  const gridItemClass = _extra?.className;

  const finalGridItemClass = gridItemClass ?? '';
  return (
    <div
      ref={ref}
      className={gridItemStyle({
        class: className + ' ' + finalGridItemClass,
      })}
      {...toDomProps(props)}
    />
  );
});

Grid.displayName = 'Grid';
GridItem.displayName = 'GridItem';

export { Grid, GridItem };
