import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { ActivityLinkMarker } from '../activity-link-marker';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ActivityLinkMarker', () => {
  it.each([[2], [3], [4]])('renders the auto-linked marker for source %p', (source) => {
    render(<ActivityLinkMarker source={source} />);

    const marker = screen.getByTestId('activity-link-marker-auto');
    expect(marker.props.accessibilityLabel).toBe('call_detail.activity_link.auto');
    expect(marker.props.accessibilityHint).toBe('call_detail.activity_link.auto_hint');
    expect(screen.getByText('call_detail.activity_link.auto')).toBeTruthy();
    expect(screen.queryByTestId('activity-link-marker-inferred')).toBeNull();
  });

  it('renders the inferred marker for source 5', () => {
    render(<ActivityLinkMarker source={5} />);

    const marker = screen.getByTestId('activity-link-marker-inferred');
    expect(marker.props.accessibilityLabel).toBe('call_detail.activity_link.inferred');
    expect(marker.props.accessibilityHint).toBe('call_detail.activity_link.inferred_hint');
    expect(screen.getByText('call_detail.activity_link.inferred')).toBeTruthy();
    expect(screen.queryByTestId('activity-link-marker-auto')).toBeNull();
  });

  it.each([[1], [null], [undefined]])('renders nothing for source %p', (source) => {
    render(<ActivityLinkMarker source={source} />);

    expect(screen.queryByTestId('activity-link-marker-auto')).toBeNull();
    expect(screen.queryByTestId('activity-link-marker-inferred')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });
});
