import { getAppTabBarHeight } from '@/lib/app-shell-layout';

describe('getAppTabBarHeight', () => {
  it('adds the bottom safe-area inset in portrait', () => {
    expect(getAppTabBarHeight(34, false)).toBe(94);
  });

  it('uses the fixed landscape height, ignoring the inset', () => {
    expect(getAppTabBarHeight(34, true)).toBe(65);
  });

  it('treats a negative inset as zero', () => {
    expect(getAppTabBarHeight(-10, false)).toBe(60);
  });
});
