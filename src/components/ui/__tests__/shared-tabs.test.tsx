import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SharedTabs, type TabItem } from '@/components/ui/shared-tabs';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return {
    ChevronLeft: () => <View testID="left-chevron" />,
    ChevronRight: () => <View testID="right-chevron" />,
  };
});

const tabs: TabItem[] = [
  { key: 'details', title: 'call_detail.details', content: null },
  { key: 'timeline', title: 'call_detail.timeline', content: null },
  { key: 'command', title: 'incident_command.tab_title', content: null },
  { key: 'checkin', title: 'check_in.tab_title', content: null },
];

describe('SharedTabs', () => {
  it('keeps tab titles on one line', () => {
    const { getByTestId, getByText, unmount } = render(<SharedTabs tabs={tabs} />);

    expect(getByText('call_detail.details').props.numberOfLines).toBe(1);
    expect(getByText('incident_command.tab_title').props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(getByTestId('shared-tab-details').props.style)).toMatchObject({ flexShrink: 0 });

    unmount();
  });

  it('shows overflow indicators based on the horizontal scroll position', () => {
    const { getByTestId, queryByTestId, unmount } = render(<SharedTabs tabs={tabs} showOverflowIndicators />);
    const scrollView = getByTestId('shared-tabs-scroll-view');

    fireEvent(scrollView, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(scrollView, 'contentSizeChange', 400, 40);

    expect(queryByTestId('shared-tabs-left-overflow')).toBeNull();
    expect(getByTestId('shared-tabs-right-overflow')).toBeTruthy();

    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 100, y: 0 } } });

    expect(getByTestId('shared-tabs-left-overflow')).toBeTruthy();
    expect(getByTestId('shared-tabs-right-overflow')).toBeTruthy();

    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 200, y: 0 } } });

    expect(getByTestId('shared-tabs-left-overflow')).toBeTruthy();
    expect(queryByTestId('shared-tabs-right-overflow')).toBeNull();

    unmount();
  });

  it('renders warning and critical badge colors', () => {
    const badgeTabs: TabItem[] = [
      { key: 'warning', title: 'Warning', content: null, badge: 1, badgeVariant: 'warning' },
      { key: 'critical', title: 'Critical', content: null, badge: 2, badgeVariant: 'critical' },
    ];
    const { getByTestId, unmount } = render(<SharedTabs tabs={badgeTabs} />);

    expect(getByTestId('shared-tab-warning-badge').props.className).toContain('bg-warning-500');
    expect(getByTestId('shared-tab-critical-badge').props.className).toContain('bg-error-500');

    unmount();
  });
});
