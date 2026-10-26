import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});

// Render the sheet inline so its rows are reachable.
jest.mock('@/components/ui/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CustomBottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (isOpen ? React.createElement(View, { testID: 'poi-sheet' }, children) : null),
  };
});

import { type PoiResultData, type PoiTypeResultData } from '@/models/v4/mapping/poiResultData';

import { DestinationPoiSelector } from '../destination-poi-selector';

const poiTypes = [
  { PoiTypeId: 1, Name: 'Hospital', IsDestination: true, IconUrl: 'https://cdn.example.test/hospital.png' },
  { PoiTypeId: 2, Name: 'Shelter', IsDestination: true },
] as PoiTypeResultData[];

const destinationPois = [
  { PoiId: 10, PoiTypeId: 1, PoiTypeName: 'Hospital', Name: 'General Hospital', Address: '1 Main St', Note: '', IsDestination: true },
  { PoiId: 11, PoiTypeId: 2, PoiTypeName: 'Shelter', Name: 'North Shelter', Address: '', Note: '', IsDestination: true },
] as PoiResultData[];

// The icon is decorative (hidden from accessibility services), so queries must opt in to hidden elements.
const hidden = { includeHiddenElements: true };

describe('DestinationPoiSelector', () => {
  it('shows each destination POI with its type icon, when the type has one', () => {
    render(<DestinationPoiSelector destinationPois={destinationPois} poiTypes={poiTypes} selectedPoiId={null} isLoading={false} onChange={jest.fn()} />);

    fireEvent.press(screen.getByText('calls.destination_poi_none'));

    expect(screen.getByTestId('destination-poi-type-icon-10', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/hospital.png' });
    expect(screen.queryByTestId('destination-poi-type-icon-11', hidden)).toBeNull();
    expect(screen.getByText('North Shelter')).toBeTruthy();
  });

  it('shows the selected POI type icon on the picker button', () => {
    render(<DestinationPoiSelector destinationPois={destinationPois} poiTypes={poiTypes} selectedPoiId={10} isLoading={false} onChange={jest.fn()} />);

    expect(screen.getByTestId('destination-poi-selected-type-icon', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/hospital.png' });
  });
});
