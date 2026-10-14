import React from 'react';
import { StyleSheet, View } from 'react-native';

/** The gap between the button and the ring, then the ring's own line. */
const RING_GAP = 2;
const RING_WIDTH = 2;

/** How far the ring reaches outside the button; the container needs this much room so it is not clipped. */
export const CURRENT_STATUS_RING_OUTSET = RING_GAP + RING_WIDTH;

interface CurrentStatusRingProps {
  /** Corner radius of the button it surrounds, so the ring's corners follow it. */
  radius: number;
  testID?: string;
}

/**
 * Marks the unit's current status with a thin ring just outside its button: a small gap, then a neutral line
 * that follows the theme. Keeping it off the button means it shows whatever colour the status is.
 *
 * Render it first inside a plain wrapper around the button; it takes no space of its own.
 */
export const CurrentStatusRing: React.FC<CurrentStatusRingProps> = React.memo(({ radius, testID }) => (
  <View pointerEvents="none" testID={testID} className="border-gray-500 dark:border-gray-400" style={[styles.ring, { borderRadius: radius + CURRENT_STATUS_RING_OUTSET }]} />
));

CurrentStatusRing.displayName = 'CurrentStatusRing';

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -CURRENT_STATUS_RING_OUTSET,
    right: -CURRENT_STATUS_RING_OUTSET,
    bottom: -CURRENT_STATUS_RING_OUTSET,
    left: -CURRENT_STATUS_RING_OUTSET,
    borderWidth: RING_WIDTH,
  },
});
