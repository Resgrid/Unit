import { render } from '@testing-library/react-native';
import React from 'react';

import { CallCard } from '../call-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// If the card ever reintroduces the WebView-backed renderer, this mock makes it
// visible in the tree so the assertions below fail loudly.
jest.mock('@/components/ui/html-renderer', () => {
  const { View } = require('react-native');
  return {
    HtmlRenderer: () => <View testID="html-renderer" />,
  };
});

const baseCall = {
  CallId: '42',
  Number: '2024-042',
  Name: 'Structure Fire',
  Address: '1 Main St',
  Nature: '<p>Heavy smoke &amp; flames showing</p>',
  Priority: 1,
  LoggedOnUtc: new Date().toISOString(),
} as never;

const priority = { Id: 1, Name: 'High', Color: '#ff0000' } as never;

describe('CallCard', () => {
  it('renders the call nature as plain text, not a WebView', () => {
    const { queryByTestId, getByText, unmount } = render(<CallCard call={baseCall} priority={priority} />);

    // A WebView per FlashList row is far too heavy — the card must render text.
    expect(queryByTestId('html-renderer')).toBeNull();
    expect(getByText('Heavy smoke & flames showing')).toBeTruthy();

    unmount();
  });

  it('limits the nature preview to a few lines', () => {
    const { getByText, unmount } = render(<CallCard call={baseCall} priority={priority} />);

    expect(getByText('Heavy smoke & flames showing').props.numberOfLines).toBe(4);

    unmount();
  });

  it('renders no nature block when the call has no nature', () => {
    const { queryByTestId, unmount } = render(<CallCard call={{ ...(baseCall as object), Nature: '' } as never} priority={priority} />);

    expect(queryByTestId('html-renderer')).toBeNull();

    unmount();
  });

  it('renders a nature that is only markup as no nature block', () => {
    const { queryByText, unmount } = render(<CallCard call={{ ...(baseCall as object), Nature: '<p></p>' } as never} priority={priority} />);

    expect(queryByText('<p></p>')).toBeNull();

    unmount();
  });

  it('picks the higher-contrast text colour for the priority background', () => {
    const red = render(<CallCard call={baseCall} priority={priority} />);
    expect(red.getByText('#2024-042').props.style).toEqual(expect.objectContaining({ color: '#000000' }));
    red.unmount();

    const navy = render(<CallCard call={baseCall} priority={{ Id: 2, Name: 'Low', Color: '#1e3a8a' } as never} />);
    expect(navy.getByText('#2024-042').props.style).toEqual(expect.objectContaining({ color: '#FFFFFF' }));
    navy.unmount();
  });

  it('renders a priority colour that is not hex instead of throwing', () => {
    const { getByText, unmount } = render(<CallCard call={baseCall} priority={{ Id: 3, Name: 'Odd', Color: 'rgb(200, 0, 0)' } as never} />);

    expect(getByText('#2024-042').props.style).toEqual(expect.objectContaining({ color: '#000000' }));

    unmount();
  });

  it('still renders the core call fields', () => {
    const { getByText, unmount } = render(<CallCard call={baseCall} priority={priority} />);

    expect(getByText('#2024-042')).toBeTruthy();
    expect(getByText('Structure Fire')).toBeTruthy();
    expect(getByText('1 Main St')).toBeTruthy();

    unmount();
  });
});
