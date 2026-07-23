import { render, screen } from '@testing-library/react-native';
import React from 'react';

import Routes from '../routes';

jest.mock('@/components/routes/routes-home', () => {
  const { View } = require('react-native');
  return {
    RoutesHome: () => <View testID="routes-home" />,
  };
});

jest.mock('@/components/ui/focus-aware-status-bar', () => {
  const { View } = require('react-native');
  return {
    FocusAwareStatusBar: () => <View testID="focus-aware-status-bar" />,
  };
});

describe('Routes tab', () => {
  it('keeps the shared system-bar controller mounted', () => {
    const { unmount } = render(<Routes />);

    expect(screen.getByTestId('focus-aware-status-bar')).toBeTruthy();
    expect(screen.getByTestId('routes-home')).toBeTruthy();
    unmount();
  });
});
