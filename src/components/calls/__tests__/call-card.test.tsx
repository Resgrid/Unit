import { render } from '@testing-library/react-native';
import React from 'react';

import { MAP_ICONS } from '@/constants/map-icons';

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

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
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

  it('picks the text colour for an rgb() priority colour', () => {
    const { getByText, root, unmount } = render(<CallCard call={baseCall} priority={{ Id: 3, Name: 'Odd', Color: 'rgb(200, 0, 0)' } as never} />);

    expect(root).toHaveStyle({ backgroundColor: 'rgb(200, 0, 0)' });
    expect(getByText('#2024-042').props.style).toEqual(expect.objectContaining({ color: '#FFFFFF' }));

    unmount();
  });

  it('draws the default grey behind the text when the priority colour cannot be read', () => {
    const { getByText, root, unmount } = render(<CallCard call={baseCall} priority={{ Id: 4, Name: 'Odd', Color: 'hsl(0, 100%, 25%)' } as never} />);

    expect(root).toHaveStyle({ backgroundColor: '#808080' });
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

  describe('dispatch chips', () => {
    // The type icon is decorative (hidden from accessibility services), so queries must opt in to hidden elements.
    const hidden = { includeHiddenElements: true };
    const dispatch = (overrides: Record<string, unknown>) => ({ Id: '1', Type: 'Unit', Name: 'Ambulance 1', Group: '', ...overrides }) as never;

    it('shows a unit type icon in place of the U badge', () => {
      const dispatches = [dispatch({ Id: '7', TypeIconUrl: 'https://cdn.example.test/ambulance.png', TypeMapIcon: 'ambulance' })];
      const { getByTestId, getByText, queryByText, unmount } = render(<CallCard call={baseCall} priority={priority} dispatches={dispatches} />);

      expect(getByText('Ambulance 1')).toBeTruthy();
      expect(getByTestId('dispatch-chip-unit-icon-7', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/ambulance.png' });
      expect(queryByText('U')).toBeNull();

      unmount();
    });

    it('keeps the U badge for a unit whose type has no icon (older servers)', () => {
      const { getByText, queryByTestId, unmount } = render(<CallCard call={baseCall} priority={priority} dispatches={[dispatch({ Id: '7' })]} />);

      expect(getByText('U')).toBeTruthy();
      expect(queryByTestId('dispatch-chip-unit-icon-7', hidden)).toBeNull();

      unmount();
    });

    it('keeps the letter badge for personnel', () => {
      const dispatches = [dispatch({ Id: '8', Type: 'Personnel', Name: 'Jane Doe', TypeIconUrl: 'https://cdn.example.test/ignored.png' })];
      const { getByText, queryByTestId, unmount } = render(<CallCard call={baseCall} priority={priority} dispatches={dispatches} />);

      expect(getByText('P')).toBeTruthy();
      expect(queryByTestId('dispatch-chip-unit-icon-8', hidden)).toBeNull();

      unmount();
    });
  });

  describe('call type icon', () => {
    // The type icon is decorative (hidden from accessibility services), so queries must opt in to hidden elements.
    const hidden = { includeHiddenElements: true };

    it('shows the uploaded call type icon in the header', () => {
      const call = { ...(baseCall as object), TypeIconUrl: 'https://cdn.example.test/fire.png', TypeMapIcon: 'fire' } as never;
      const { getByTestId, unmount } = render(<CallCard call={call} priority={priority} />);

      expect(getByTestId('call-card-type-icon', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/fire.png' });

      unmount();
    });

    it('shows the built-in call type icon when the type has no upload', () => {
      const call = { ...(baseCall as object), TypeIconUrl: null, TypeMapIcon: 'caraccident' } as never;
      const { getByTestId, unmount } = render(<CallCard call={call} priority={priority} />);

      expect(getByTestId('call-card-type-icon', hidden).props.source).toBe(MAP_ICONS.caraccident.uri);

      unmount();
    });

    it('keeps the generic alert icon for calls from older servers', () => {
      const { queryByTestId, getByText, unmount } = render(<CallCard call={baseCall} priority={priority} />);

      expect(queryByTestId('call-card-type-icon', hidden)).toBeNull();
      expect(getByText('#2024-042')).toBeTruthy();

      unmount();
    });
  });
});
