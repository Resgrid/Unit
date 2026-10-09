import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { CURRENT_STATUS_RING_OUTSET, CurrentStatusRing } from '../current-status-ring';

describe('CurrentStatusRing', () => {
  it('sits just outside the button with corners that follow it', () => {
    render(<CurrentStatusRing radius={8} testID="ring" />);

    const ring = screen.getByTestId('ring');
    const style = StyleSheet.flatten(ring.props.style);

    expect(style).toMatchObject({
      position: 'absolute',
      top: -CURRENT_STATUS_RING_OUTSET,
      right: -CURRENT_STATUS_RING_OUTSET,
      bottom: -CURRENT_STATUS_RING_OUTSET,
      left: -CURRENT_STATUS_RING_OUTSET,
      borderRadius: 8 + CURRENT_STATUS_RING_OUTSET,
    });
  });

  it('never takes touches meant for the button', () => {
    render(<CurrentStatusRing radius={4} testID="ring" />);

    expect(screen.getByTestId('ring').props.pointerEvents).toBe('none');
  });
});
