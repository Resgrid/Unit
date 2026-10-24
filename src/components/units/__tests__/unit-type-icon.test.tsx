import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});

import { MAP_ICONS } from '@/constants/map-icons';

import { getUnitTypeMapIconKey, TypeIcon, UnitTypeIcon } from '../unit-type-icon';

const ICON_URL = 'https://cdn.example.test/unit-types/7/icon-abc.png';
// The icon is decorative (hidden from accessibility services), so queries must opt in to hidden elements.
const HIDDEN = { includeHiddenElements: true };

describe('UnitTypeIcon', () => {
  it('renders the uploaded icon when a URL is given', () => {
    render(<UnitTypeIcon iconUrl={ICON_URL} mapIcon="ambulance" size={30} testID="icon" />);

    const image = screen.getByTestId('icon', HIDDEN);
    expect(image.props.source).toEqual({ uri: ICON_URL });
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.cachePolicy).toBe('memory-disk');
    expect(image.props.style).toEqual({ width: 30, height: 30 });
  });

  it('renders the bundled map icon when there is no upload, matching the name case-insensitively', () => {
    render(<UnitTypeIcon iconUrl={null} mapIcon="Ambulance" testID="icon" />);

    const image = screen.getByTestId('icon', HIDDEN);
    expect(image.props.source).toBe(MAP_ICONS.ambulance.uri);
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.style).toEqual({ width: 24, height: 24 });
  });

  it('renders the fallback when there is no upload and no known map icon', () => {
    render(<UnitTypeIcon iconUrl="" mapIcon="not-a-bundled-icon" fallback={<Text>U</Text>} testID="icon" />);

    expect(screen.queryByTestId('icon', HIDDEN)).toBeNull();
    expect(screen.getByText('U')).toBeTruthy();
  });

  it('renders nothing by default when there is nothing to show', () => {
    const { toJSON } = render(<UnitTypeIcon testID="icon" />);

    expect(toJSON()).toBeNull();
  });

  it('falls back to the bundled map icon when the upload fails to load', () => {
    render(<UnitTypeIcon iconUrl={ICON_URL} mapIcon="cartwo" testID="icon" />);

    act(() => {
      fireEvent(screen.getByTestId('icon', HIDDEN), 'error', { error: 'boom' });
    });

    expect(screen.getByTestId('icon', HIDDEN).props.source).toBe(MAP_ICONS.cartwo.uri);
  });

  it('falls back to the fallback when the upload fails to load and there is no map icon', () => {
    render(<UnitTypeIcon iconUrl={ICON_URL} fallback={<Text>U</Text>} testID="icon" />);

    act(() => {
      fireEvent(screen.getByTestId('icon', HIDDEN), 'error', { error: 'boom' });
    });

    expect(screen.queryByTestId('icon', HIDDEN)).toBeNull();
    expect(screen.getByText('U')).toBeTruthy();
  });

  it('tries a new upload URL after an earlier one failed', () => {
    const { rerender } = render(<UnitTypeIcon iconUrl={ICON_URL} fallback={<Text>U</Text>} testID="icon" />);

    act(() => {
      fireEvent(screen.getByTestId('icon', HIDDEN), 'error', { error: 'boom' });
    });
    expect(screen.queryByTestId('icon', HIDDEN)).toBeNull();

    const nextUrl = 'https://cdn.example.test/unit-types/7/icon-def.png';
    rerender(<UnitTypeIcon iconUrl={nextUrl} fallback={<Text>U</Text>} testID="icon" />);

    expect(screen.getByTestId('icon', HIDDEN).props.source).toEqual({ uri: nextUrl });
  });

  it('is hidden from accessibility services', () => {
    render(<UnitTypeIcon mapIcon="ambulance" testID="icon" />);

    const image = screen.getByTestId('icon', HIDDEN);
    expect(image.props.accessible).toBe(false);
    expect(image.props.accessibilityElementsHidden).toBe(true);
    expect(image.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('TypeIcon', () => {
  it('is the same component, for call and POI type icons', () => {
    expect(TypeIcon).toBe(UnitTypeIcon);

    render(<TypeIcon mapIcon="fire" testID="icon" />);
    expect(screen.getByTestId('icon', HIDDEN).props.source).toBe(MAP_ICONS.fire.uri);
  });
});

describe('getUnitTypeMapIconKey', () => {
  it('returns the lowercase bundled key for a known name', () => {
    expect(getUnitTypeMapIconKey('FourByFour')).toBe('fourbyfour');
    expect(getUnitTypeMapIconKey(' ambulance ')).toBe('ambulance');
  });

  it('returns null for missing, unknown or prototype names', () => {
    expect(getUnitTypeMapIconKey(undefined)).toBeNull();
    expect(getUnitTypeMapIconKey(null)).toBeNull();
    expect(getUnitTypeMapIconKey('')).toBeNull();
    expect(getUnitTypeMapIconKey('spaceship')).toBeNull();
    expect(getUnitTypeMapIconKey('constructor')).toBeNull();
  });
});
