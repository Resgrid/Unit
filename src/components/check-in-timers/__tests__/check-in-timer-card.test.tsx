import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';

import { CheckInTimerCard } from '../check-in-timer-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  Timer: (props: any) => {
    const { View } = require('react-native');
    return <View testID="timer-icon" />;
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

const createMockTimer = (overrides: Partial<CheckInTimerStatusResultData> = {}): CheckInTimerStatusResultData => ({
  TargetType: 0,
  TargetTypeName: 'Unit',
  TargetEntityId: '1',
  TargetName: 'Engine 1',
  UnitId: '1',
  LastCheckIn: '2026-04-12T10:00:00Z',
  DurationMinutes: 30,
  WarningThresholdMinutes: 20,
  ElapsedMinutes: 10,
  Status: 'Ok',
  ...overrides,
});

describe('CheckInTimerCard', () => {
  it('should render timer info', () => {
    const timer = createMockTimer();
    const onCheckIn = jest.fn();

    const { getByText } = render(<CheckInTimerCard timer={timer} onCheckIn={onCheckIn} />);

    expect(getByText('Engine 1')).toBeTruthy();
    expect(getByText('Unit')).toBeTruthy();
    expect(getByText('check_in.perform_check_in')).toBeTruthy();
  });

  it('should call onCheckIn when button pressed', () => {
    const timer = createMockTimer();
    const onCheckIn = jest.fn();

    const { getByText } = render(<CheckInTimerCard timer={timer} onCheckIn={onCheckIn} />);

    fireEvent.press(getByText('check_in.perform_check_in'));
    expect(onCheckIn).toHaveBeenCalledTimes(1);
  });

  it('should hide check-in button when showCheckInButton is false', () => {
    const timer = createMockTimer();
    const onCheckIn = jest.fn();

    const { queryByText } = render(<CheckInTimerCard timer={timer} onCheckIn={onCheckIn} showCheckInButton={false} />);

    expect(queryByText('check_in.perform_check_in')).toBeNull();
  });

  it('should render warning status', () => {
    const timer = createMockTimer({ Status: 'Warning', ElapsedMinutes: 22 });
    const onCheckIn = jest.fn();

    const { getByText } = render(<CheckInTimerCard timer={timer} onCheckIn={onCheckIn} />);

    expect(getByText('check_in.status_warning')).toBeTruthy();
  });

  it('should render overdue status', () => {
    const timer = createMockTimer({ Status: 'Overdue', ElapsedMinutes: 35 });
    const onCheckIn = jest.fn();

    const { getByText } = render(<CheckInTimerCard timer={timer} onCheckIn={onCheckIn} />);

    expect(getByText('check_in.status_overdue')).toBeTruthy();
  });
});
