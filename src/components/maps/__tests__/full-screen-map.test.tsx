import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { FullScreenMap } from '@/components/maps/full-screen-map';

interface MockMapComponentProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

jest.mock('@env', () => ({
  Env: {
    UNIT_MAPBOX_PUBKEY: 'test-mapbox-key',
  },
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return {
    MapPinIcon: () => <View testID="map-pin-icon" />,
    XIcon: () => <View testID="close-icon" />,
  };
});

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children, ...props }: MockMapComponentProps) => <Text {...props}>{children}</Text>,
  };
});

jest.mock('@/components/maps/mapbox', () => {
  const { View } = require('react-native');
  const MapView = ({ children, ...props }: MockMapComponentProps) => (
    <View testID="map-view" {...props}>
      {children}
    </View>
  );
  const Camera = (props: MockMapComponentProps) => <View testID="map-camera" {...props} />;
  const PointAnnotation = ({ children, ...props }: MockMapComponentProps) => (
    <View testID="map-point-annotation" {...props}>
      {children}
    </View>
  );

  return {
    __esModule: true,
    default: {
      Camera,
      MapView,
      PointAnnotation,
      setAccessToken: jest.fn(),
      StyleURL: {
        Dark: 'dark',
        Street: 'street',
      },
    },
  };
});

describe('FullScreenMap', () => {
  it('centers the camera and marker on the supplied location', () => {
    const onClose = jest.fn();
    const { unmount } = render(<FullScreenMap isOpen latitude={40.7128} longitude={-74.006} title="Test Call" address="123 Main St" onClose={onClose} />);

    expect(screen.getByTestId('map-camera').props).toMatchObject({
      centerCoordinate: [-74.006, 40.7128],
      zoomLevel: 15,
    });
    expect(screen.getByTestId('map-point-annotation').props).toMatchObject({
      coordinate: [-74.006, 40.7128],
      title: 'Test Call',
    });
    expect(screen.getByText('123 Main St')).toBeTruthy();

    fireEvent.press(screen.getByTestId('full-screen-call-map-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });
});
