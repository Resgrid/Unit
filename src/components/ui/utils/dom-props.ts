import { StyleSheet } from 'react-native';

type WithTestID = { testID?: string };

// React Native-only props that must never reach a DOM element. React warns
// ("React does not recognize the X prop on a DOM element") when these leak
// through the web wrappers that spread props onto raw elements.
const RN_ONLY_PROPS = new Set([
  'testID',
  'numberOfLines',
  'ellipsizeMode',
  'adjustsFontSizeToFit',
  'allowFontScaling',
  'maxFontSizeMultiplier',
  'minimumFontScale',
  'suppressHighlighting',
  'selectable',
  'selectionColor',
  'textBreakStrategy',
  'lineBreakStrategyIOS',
  'dataDetectorType',
  'onTextLayout',
  'onLayout',
  'nativeID',
  'hitSlop',
  'collapsable',
  'needsOffscreenAlphaCompositing',
  'accessibilityRole',
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityState',
  'accessibilityActions',
  'onAccessibilityAction',
  'importantForAccessibility',
  'accessibilityLiveRegion',
  'onStartShouldSetResponder',
  'onMoveShouldSetResponder',
  'onResponderGrant',
  'onResponderMove',
  'onResponderRelease',
  'onResponderTerminate',
  'onResponderTerminationRequest',
]);

/**
 * Converts React Native style props into valid DOM props.
 * Maps `testID` to `data-testid` and strips RN-only props so React does not
 * warn about unrecognized props on DOM elements.
 */
export function toDomProps<T extends object>(props: T & WithTestID): Omit<T, 'testID'> & { 'data-testid'?: string } {
  const { testID, ...rest } = props as T & WithTestID & Record<string, unknown>;
  const domProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (!RN_ONLY_PROPS.has(key)) {
      // Callers pass React Native style arrays (`style={[a, b]}`); a DOM element only takes one object, and an
      // array makes React set style[0] on the CSSStyleDeclaration, which throws and takes the whole screen down.
      domProps[key] = key === 'style' && Array.isArray(value) ? StyleSheet.flatten(value) : value;
    }
  }

  if (testID) {
    domProps['data-testid'] = testID;
  }

  return domProps as Omit<T, 'testID'> & { 'data-testid'?: string };
}
