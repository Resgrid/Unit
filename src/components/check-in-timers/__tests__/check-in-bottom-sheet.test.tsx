import React from 'react';
import { render } from '@testing-library/react-native';

import { CheckInBottomSheet } from '../check-in-bottom-sheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn((selector: any) => selector({ activeUnit: null })),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn((selector: any) => selector({ latitude: 40.7128, longitude: -74.006 })),
}));

const mockPerformCheckIn = jest.fn().mockResolvedValue(true) as any;

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: jest.fn((selector: any) =>
    selector({
      performCheckIn: mockPerformCheckIn,
      isCheckingIn: false,
    })
  ),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn((selector: any) => selector({ showToast: jest.fn() })),
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => {
    const { View } = require('react-native');
    return isOpen ? <View>{children}</View> : null;
  },
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} {...props}>
        {children}
      </TouchableOpacity>
    );
  },
  ButtonText: ({ children }: any) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children }: any) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText {...props}>{children}</RNText>;
  },
}));

describe('CheckInBottomSheet', () => {
  it('should not render content when closed', () => {
    const { queryByText } = render(<CheckInBottomSheet isOpen={false} onClose={jest.fn()} callId={1} />);

    expect(queryByText('check_in.perform_check_in')).toBeNull();
  });

  it('should render content when open', () => {
    const { getByText } = render(<CheckInBottomSheet isOpen={true} onClose={jest.fn()} callId={1} />);

    expect(getByText('check_in.perform_check_in')).toBeTruthy();
    expect(getByText('check_in.select_type')).toBeTruthy();
    expect(getByText('check_in.confirm')).toBeTruthy();
  });

  it('should render all check-in type buttons', () => {
    const { getByText } = render(<CheckInBottomSheet isOpen={true} onClose={jest.fn()} callId={1} />);

    expect(getByText('check_in.type_personnel')).toBeTruthy();
    expect(getByText('check_in.type_unit')).toBeTruthy();
    expect(getByText('check_in.type_ic')).toBeTruthy();
    expect(getByText('check_in.type_par')).toBeTruthy();
    expect(getByText('check_in.type_hazmat')).toBeTruthy();
    expect(getByText('check_in.type_sector_rotation')).toBeTruthy();
    expect(getByText('check_in.type_rehab')).toBeTruthy();
  });
});
