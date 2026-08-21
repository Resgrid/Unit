/**
 * Exercises the real FullScreenImageModal.
 *
 * Only dependencies are mocked, and the two that carry behaviour (reanimated shared
 * values and the gesture builders) are mocked as thin, faithful plumbing: shared values
 * are real mutable objects and the gesture callbacks registered by the component are
 * captured so the component's own clamping/reset logic runs for real.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const icon = React.forwardRef((props: Record<string, unknown>, ref: unknown) => React.createElement(View, { ...props, ref }));
  return new Proxy({}, { get: () => icon });
});

// gluestack's Modal only mounts its children while isOpen; the backdrop is pressable.
jest.mock('@/components/ui/modal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return {
    Modal: ({ children, isOpen }: any) => (isOpen ? React.createElement(View, { testID: 'modal' }, children) : null),
    ModalBackdrop: ({ onPress, ...props }: any) => React.createElement(Pressable, { testID: 'modal-backdrop', onPress, ...props }),
    ModalContent: ({ children, ...props }: any) => React.createElement(View, { testID: 'modal-content', ...props }, children),
  };
});

jest.mock('@/components/ui/image', () => {
  const React = require('react');
  const { Image: RNImage } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(RNImage, props) };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  const clampedLerp = (value: number, input: number[], output: number[]) => {
    const [inMin, inMax] = input;
    const [outMin, outMax] = output;
    if (value <= inMin) return outMin;
    if (value >= inMax) return outMax;
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  };

  // Every function handed to runOnJS, so tests can check it is a stable JS-thread
  // reference rather than a closure minted inside the worklet.
  const runOnJSTargets: unknown[] = [];

  return {
    __esModule: true,
    __runOnJSTargets: runOnJSTargets,
    default: {
      View: ({ children, ...props }: any) => React.createElement(View, props, children),
    },
    // Real mutable boxes so the component's reads/writes behave like shared values.
    useSharedValue: (initial: number) => {
      const ref = React.useRef({ value: initial });
      return ref.current;
    },
    useAnimatedStyle: (factory: () => Record<string, unknown>) => factory(),
    withTiming: (value: number) => value,
    interpolate: clampedLerp,
    runOnJS: (fn: (...args: unknown[]) => unknown) => {
      runOnJSTargets.push(fn);
      return fn;
    },
  };
});

// Captures the gesture callbacks the component registers so tests can drive them.
jest.mock('react-native-gesture-handler', () => {
  const captured: Record<string, { update?: (e: any) => void; end?: () => void }> = {
    pinch: {},
    pan: {},
    tap: {},
  };

  const build = (kind: string) => {
    const gesture: any = {
      onUpdate: (fn: (e: any) => void) => {
        captured[kind].update = fn;
        return gesture;
      },
      onEnd: (fn: () => void) => {
        captured[kind].end = fn;
        return gesture;
      },
      numberOfTaps: () => gesture,
    };
    return gesture;
  };

  return {
    __captured: captured,
    Gesture: {
      Pinch: () => build('pinch'),
      Pan: () => build('pan'),
      Tap: () => build('tap'),
      Simultaneous: (...gestures: unknown[]) => gestures[0],
    },
    GestureDetector: ({ children }: any) => children,
  };
});

import FullScreenImageModal from '../full-screen-image-modal';

const { __captured: gestures } = require('react-native-gesture-handler') as {
  __captured: Record<string, { update?: (e: any) => void; end?: () => void }>;
};

const { __runOnJSTargets: runOnJSTargets } = require('react-native-reanimated') as { __runOnJSTargets: unknown[] };

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  imageSource: { uri: 'https://example.com/image.jpg' },
  imageName: 'Test Image',
};

type RenderedNode = { type: string; props: Record<string, any>; children: (RenderedNode | string)[] | null };

/** The rendered wrapper around the element carrying `testID` — i.e. the animated container. */
const wrapperOf = (tree: any, testID: string): RenderedNode => {
  const roots: RenderedNode[] = Array.isArray(tree) ? tree : [tree];
  let found: RenderedNode | undefined;

  const walk = (node: RenderedNode, parent?: RenderedNode) => {
    if (found || typeof node !== 'object' || node === null) return;
    if (node.props?.testID === testID && parent) {
      found = parent;
      return;
    }
    (node.children ?? []).forEach((child) => (typeof child === 'object' ? walk(child, node) : undefined));
  };

  roots.forEach((root) => walk(root));
  if (!found) throw new Error(`No rendered wrapper found around testID "${testID}"`);
  return found;
};

/** The transform handed to the animated image container: [{scale},{translateX},{translateY}]. */
const readTransform = (tree: any) => {
  const style = StyleSheet.flatten(wrapperOf(tree, 'full-screen-image').props.style) as { transform: Record<string, number>[] };
  return Object.assign({}, ...style.transform) as { scale: number; translateX: number; translateY: number };
};

const readCloseButtonOpacity = (tree: any) => (StyleSheet.flatten(wrapperOf(tree, 'close-button').props.style) as { opacity: number }).opacity;

describe('FullScreenImageModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runOnJSTargets.length = 0;
  });

  describe('image source resolution', () => {
    it('hands the remote URL it was given straight to the image', () => {
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      expect(getByTestId('full-screen-image').props.source).toEqual({ uri: 'https://example.com/image.jpg' });

      unmount();
    });

    it('passes a base64 data payload through untouched', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA';
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} imageSource={{ uri: dataUri }} />);

      expect(getByTestId('full-screen-image').props.source).toEqual({ uri: dataUri });

      unmount();
    });

    it('renders the image at the full screen width and contains it', () => {
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      const image = getByTestId('full-screen-image');
      expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: screenWidth, maxWidth: screenWidth });
      expect(image.props.contentFit).toBe('contain');

      unmount();
    });

    it('labels the image with the supplied name', () => {
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      expect(getByTestId('full-screen-image').props.alt).toBe('Test Image');

      unmount();
    });

    it('falls back to the translated alt text when no name is supplied', () => {
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} imageName={undefined} />);

      expect(getByTestId('full-screen-image').props.alt).toBe('callImages.image_alt');

      unmount();
    });

    it('falls back to the translated alt text for an empty name', () => {
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} imageName="" />);

      expect(getByTestId('full-screen-image').props.alt).toBe('callImages.image_alt');

      unmount();
    });
  });

  describe('visibility and closing', () => {
    it('mounts nothing while closed', () => {
      const { queryByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} isOpen={false} />);

      expect(queryByTestId('modal')).toBeNull();
      expect(queryByTestId('full-screen-image')).toBeNull();

      unmount();
    });

    it('closes when the close button is pressed', () => {
      const onClose = jest.fn();
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} onClose={onClose} />);

      fireEvent.press(getByTestId('close-button'));

      expect(onClose).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('closes when the backdrop is pressed', () => {
      const onClose = jest.fn();
      const { getByTestId, unmount } = render(<FullScreenImageModal {...defaultProps} onClose={onClose} />);

      fireEvent.press(getByTestId('modal-backdrop'));

      expect(onClose).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('does not close on its own while simply open', () => {
      const onClose = jest.fn();
      const { unmount } = render(<FullScreenImageModal {...defaultProps} onClose={onClose} />);

      expect(onClose).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('pinch to zoom', () => {
    it('starts unzoomed and unpanned', () => {
      const { toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON())).toEqual({ scale: 1, translateX: 0, translateY: 0 });

      unmount();
    });

    it('applies the pinch factor to the current scale', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 2 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON()).scale).toBe(2);

      unmount();
    });

    it('never zooms past 5x however hard the user pinches', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 50 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON()).scale).toBe(5);

      unmount();
    });

    it('never shrinks the image below its natural size', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 0.1 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON()).scale).toBe(1);

      unmount();
    });

    it('accumulates across successive pinches instead of restarting from 1', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 2 });
      gestures.pinch.end!();
      gestures.pinch.update!({ scale: 2 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON()).scale).toBe(4);

      unmount();
    });
  });

  describe('pan', () => {
    it('refuses to move an image that is not zoomed in', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pan.update!({ translationX: 400, translationY: 400 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON())).toMatchObject({ translateX: 0, translateY: 0 });

      unmount();
    });

    it('moves a zoomed image by the drag distance', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 2 });
      gestures.pinch.end!();
      gestures.pan.update!({ translationX: 40, translationY: 60 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON())).toMatchObject({ translateX: 40, translateY: 60 });

      unmount();
    });

    it('keeps the image edges from being dragged inside the viewport', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 2 });
      gestures.pinch.end!();
      gestures.pan.update!({ translationX: 999999, translationY: 999999 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      // At 2x the image overflows by one screen, so it may travel half a screen each way.
      expect(readTransform(toJSON())).toMatchObject({ translateX: screenWidth / 2, translateY: screenHeight / 2 });

      unmount();
    });

    it('clamps against the window it is currently displayed in, not the one it started in', () => {
      const original = Dimensions.get('window');
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      // Rotate: the window swaps its width and height.
      act(() => {
        Dimensions.set({ window: { ...original, width: original.height, height: original.width } });
      });

      gestures.pinch.update!({ scale: 2 });
      gestures.pinch.end!();
      gestures.pan.update!({ translationX: 999999, translationY: 999999 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON())).toMatchObject({ translateX: original.height / 2, translateY: original.width / 2 });

      act(() => {
        Dimensions.set({ window: original });
      });
      unmount();
    });

    it('pulls an off-centre image back into bounds when the user zooms back out', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 3 });
      gestures.pinch.end!();
      gestures.pan.update!({ translationX: 999999, translationY: 999999 });
      gestures.pan.end!();
      gestures.pinch.update!({ scale: 1 / 3 });
      gestures.pinch.end!();
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON())).toEqual({ scale: 1, translateX: 0, translateY: 0 });

      unmount();
    });
  });

  describe('double tap', () => {
    it('zooms to 2x', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.tap.end!();
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON()).scale).toBe(2);

      unmount();
    });

    it('returns to fit, and to centre, on the next double tap', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.tap.end!();
      gestures.pan.update!({ translationX: 999999, translationY: 999999 });
      gestures.pan.end!();
      gestures.tap.end!();
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readTransform(toJSON())).toEqual({ scale: 1, translateX: 0, translateY: 0 });

      unmount();
    });

    it('hands runOnJS one stable function instead of a fresh worklet-local closure each tap', () => {
      const { rerender, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.tap.end!();
      rerender(<FullScreenImageModal {...defaultProps} />);
      gestures.tap.end!();

      // Reanimated cannot transfer a closure created inside the worklet to the JS
      // thread; the same JS-thread reference must be scheduled every time.
      expect(runOnJSTargets.length).toBeGreaterThanOrEqual(2);
      expect(runOnJSTargets[runOnJSTargets.length - 1]).toBe(runOnJSTargets[runOnJSTargets.length - 2]);

      unmount();
    });
  });

  describe('reopening', () => {
    it('discards the previous zoom and pan when the modal is reopened', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 3 });
      gestures.pinch.end!();
      gestures.pan.update!({ translationX: 120, translationY: 90 });
      gestures.pan.end!();
      rerender(<FullScreenImageModal {...defaultProps} />);
      expect(readTransform(toJSON()).scale).toBe(3);

      rerender(<FullScreenImageModal {...defaultProps} isOpen={false} />);
      rerender(<FullScreenImageModal {...defaultProps} isOpen={true} />);
      // On device the reset effect drives the shared values straight into the native
      // animation; here one more render is needed to observe the values it wrote.
      rerender(<FullScreenImageModal {...defaultProps} isOpen={true} />);

      expect(readTransform(toJSON())).toEqual({ scale: 1, translateX: 0, translateY: 0 });

      unmount();
    });
  });

  describe('close button visibility', () => {
    it('shows the close button at full opacity when the image is not zoomed', () => {
      const { toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      expect(readCloseButtonOpacity(toJSON())).toBe(1);

      unmount();
    });

    it('fades the close button out of the way once the image is zoomed', () => {
      const { rerender, toJSON, unmount } = render(<FullScreenImageModal {...defaultProps} />);

      gestures.pinch.update!({ scale: 4 });
      rerender(<FullScreenImageModal {...defaultProps} />);

      expect(readCloseButtonOpacity(toJSON())).toBeLessThan(1);

      unmount();
    });
  });
});
