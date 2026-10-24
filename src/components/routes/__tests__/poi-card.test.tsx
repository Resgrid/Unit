import { render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});

import { type PoiResultData } from '@/models/v4/mapping/poiResultData';

import { PoiCard } from '../poi-card';

const poi = {
  PoiId: 9,
  PoiTypeId: 3,
  PoiTypeName: 'Hospital',
  Name: 'General Hospital',
  Address: '1 Main St',
  Note: '',
  Latitude: 40.7128,
  Longitude: -74.006,
  Color: '',
  ImagePath: '',
  Marker: '',
  IsDestination: true,
} as PoiResultData;

// The icon is decorative (hidden from accessibility services), so queries must opt in to hidden elements.
const hidden = { includeHiddenElements: true };

describe('PoiCard', () => {
  it('shows the POI type icon next to the name', () => {
    render(<PoiCard poi={poi} poiTypeLabel="Hospital" displayName="General Hospital" iconUrl="https://cdn.example.test/hospital.png" isDestinationEnabled={true} onPress={jest.fn()} />);

    expect(screen.getByText('General Hospital')).toBeTruthy();
    expect(screen.getByTestId('poi-card-type-icon-9', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/hospital.png' });
  });

  it('shows no icon when the POI type has none (older servers)', () => {
    render(<PoiCard poi={poi} poiTypeLabel="Hospital" displayName="General Hospital" isDestinationEnabled={false} onPress={jest.fn()} />);

    expect(screen.getByText('General Hospital')).toBeTruthy();
    expect(screen.queryByTestId('poi-card-type-icon-9', hidden)).toBeNull();
  });
});
