import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

import { WeatherAlertDetailMap } from '../weather-alert-detail-map';

const mockFitBounds = jest.fn();
const mockSetCamera = jest.fn();

interface MockMapViewProps {
  children?: React.ReactNode;
  onDidFinishLoadingMap?: () => void;
}

interface MockChildrenProps {
  children?: React.ReactNode;
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/maps/mapbox', () => {
  const ReactActual: typeof import('react') = require('react');
  const { View } = require('react-native');

  const MapView = ({ children, onDidFinishLoadingMap }: MockMapViewProps) => {
    ReactActual.useEffect(() => {
      onDidFinishLoadingMap?.();
    }, []);
    return <View testID="map-view">{children}</View>;
  };

  const Camera = ReactActual.forwardRef<unknown, Record<string, unknown>>((_props, ref) => {
    ReactActual.useImperativeHandle(ref, () => ({
      fitBounds: mockFitBounds,
      setCamera: mockSetCamera,
    }));
    return <View testID="map-camera" />;
  });

  const Container = ({ children }: MockChildrenProps) => <View>{children}</View>;

  return {
    __esModule: true,
    default: {
      Camera,
      FillLayer: View,
      LineLayer: View,
      MapView,
      PointAnnotation: Container,
      ShapeSource: Container,
    },
  };
});

const createMockAlert = (overrides: Partial<WeatherAlertResultData> = {}): WeatherAlertResultData => {
  return Object.assign(new WeatherAlertResultData(), {
    Severity: 1,
    ...overrides,
  });
};

describe('WeatherAlertDetailMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fits the camera to all polygons after the map loads', async () => {
    const polygon = JSON.stringify({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-122, 37],
            [-121, 37],
            [-121, 38],
            [-122, 37],
          ],
        ],
        [
          [
            [-119, 39],
            [-118, 39],
            [-118, 40],
            [-119, 39],
          ],
        ],
      ],
    });

    const { unmount } = render(<WeatherAlertDetailMap alert={createMockAlert({ Polygon: polygon })} />);

    await waitFor(() => {
      expect(mockFitBounds).toHaveBeenCalledWith([-118, 40], [-122, 37], 40, 0);
    });
    unmount();
  });

  it('centers the camera on Core center coordinates when no polygon exists', async () => {
    const { unmount } = render(<WeatherAlertDetailMap alert={createMockAlert({ CenterGeoLocation: '39.5,-119.75' })} />);

    await waitFor(() => {
      expect(mockSetCamera).toHaveBeenCalledWith({
        centerCoordinate: [-119.75, 39.5],
        zoomLevel: 8,
        animationDuration: 0,
        animationMode: 'moveTo',
      });
    });
    unmount();
  });

  it('shows a location unavailable state instead of the US default map', () => {
    const { unmount } = render(<WeatherAlertDetailMap alert={createMockAlert()} />);

    expect(screen.getByText('call_detail.no_location')).toBeTruthy();
    expect(screen.queryByTestId('map-view')).toBeNull();
    unmount();
  });
});
