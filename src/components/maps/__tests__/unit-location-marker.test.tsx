import { render } from '@testing-library/react-native';
import React from 'react';

import UnitLocationMarker from '../unit-location-marker';

jest.mock('@/components/maps/mapbox', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const passthrough = (name: string) =>
    Object.assign(({ children, ...props }: any) => ReactActual.createElement(View, { testID: props.id ?? name, ...props }, children), { displayName: name });
  return {
    __esModule: true,
    default: {
      ShapeSource: passthrough('ShapeSource'),
      FillLayer: passthrough('FillLayer'),
      LineLayer: passthrough('LineLayer'),
      CircleLayer: passthrough('CircleLayer'),
      SymbolLayer: passthrough('SymbolLayer'),
      Images: passthrough('Images'),
    },
  };
});

describe('UnitLocationMarker', () => {
  it('renders the location dot', () => {
    const { getByTestId, unmount } = render(<UnitLocationMarker latitude={40.7} longitude={-74.0} heading={null} accuracy={null} />);
    expect(getByTestId('unit-location-dot')).toBeTruthy();
    unmount();
  });

  it('renders the accuracy circle when accuracy is known', () => {
    const { getByTestId, unmount } = render(<UnitLocationMarker latitude={40.7} longitude={-74.0} heading={null} accuracy={25} />);
    expect(getByTestId('unit-location-accuracy')).toBeTruthy();
    expect(getByTestId('unit-location-accuracy-fill')).toBeTruthy();
    unmount();
  });

  it('hides the accuracy circle when accuracy is missing or invalid', () => {
    const { queryByTestId, unmount } = render(<UnitLocationMarker latitude={40.7} longitude={-74.0} heading={90} accuracy={0} />);
    expect(queryByTestId('unit-location-accuracy')).toBeNull();
    unmount();
  });

  it('renders the heading arrow rotated to the current heading', () => {
    const { getByTestId, unmount } = render(<UnitLocationMarker latitude={40.7} longitude={-74.0} heading={90} accuracy={10} />);
    const arrow = getByTestId('unit-location-heading');
    expect(arrow.props.style.iconRotate).toBe(90);
    expect(arrow.props.style.iconRotationAlignment).toBe('map');
    unmount();
  });

  it('hides the heading arrow when there is no heading fix', () => {
    // iOS reports "no heading" as -1
    const { queryByTestId, unmount } = render(<UnitLocationMarker latitude={40.7} longitude={-74.0} heading={-1} accuracy={10} />);
    expect(queryByTestId('unit-location-heading')).toBeNull();
    unmount();
  });
});
