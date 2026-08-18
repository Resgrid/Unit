const PORTRAIT_TAB_BAR_CONTENT_HEIGHT = 60;
const LANDSCAPE_TAB_BAR_HEIGHT = 65;

/**
 * Height of the bottom tab bar, matching the `tabBarStyle` the app shell sets.
 *
 * Screens that lift their content over the soft keyboard need this: the tab bar sits
 * between them and the bottom of the display, and the keyboard covers it, so that much of
 * the keyboard is already accounted for.
 */
export const getAppTabBarHeight = (bottomInset: number, isLandscape: boolean): number => {
  const safeBottomInset = Math.max(0, bottomInset);
  return isLandscape ? LANDSCAPE_TAB_BAR_HEIGHT : PORTRAIT_TAB_BAR_CONTENT_HEIGHT + safeBottomInset;
};
