import React from 'react';
import { render } from '@testing-library/react-native';

import { CheckInTabContent } from '@/components/check-in-timers/check-in-tab-content';
import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';

const mockQuickCheckIn = jest.fn();
let mockTimerStatuses: CheckInTimerStatusResultData[] = [];
let mockActiveUnit: { TypeId: number } | null = { TypeId: 10 };
let mockUserId: string | null = 'user-1';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/use-quick-check-in', () => ({
  useQuickCheckIn: () => ({ quickCheckIn: mockQuickCheckIn, isCheckingIn: false }),
}));

jest.mock('@/lib/auth', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: mockUserId }),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: (selector: (state: { activeUnit: { TypeId: number } | null }) => unknown) => selector({ activeUnit: mockActiveUnit }),
}));

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      timerStatuses: mockTimerStatuses,
      checkInHistory: [],
      isLoadingStatuses: false,
      fetchCheckInHistory: jest.fn(),
    }),
}));

jest.mock('@/components/check-in-timers/check-in-timer-card', () => ({
  CheckInTimerCard: ({ timer }: { timer: CheckInTimerStatusResultData }) => {
    const { Text } = require('react-native');
    return <Text>{timer.TargetName}</Text>;
  },
}));

jest.mock('@/components/check-in-timers/check-in-history-list', () => ({
  CheckInHistoryList: () => null,
}));

jest.mock('@/components/check-in-timers/check-in-bottom-sheet', () => ({
  CheckInBottomSheet: () => null,
}));

const createTimer = (TargetType: number, TargetEntityId: string, TargetName: string): CheckInTimerStatusResultData => ({
  TargetType,
  TargetTypeName: TargetName,
  TargetEntityId,
  TargetName,
  UnitId: '',
  LastCheckIn: '',
  DurationMinutes: 30,
  WarningThresholdMinutes: 5,
  ElapsedMinutes: 10,
  Status: 'Green',
});

describe('CheckInTabContent', () => {
  beforeEach(() => {
    mockActiveUnit = { TypeId: 10 };
    mockUserId = 'user-1';
    mockTimerStatuses = [];
  });

  it('shows only the matching UnitType target and excludes IC', () => {
    mockTimerStatuses = [createTimer(1, '10', 'Matching UnitType'), createTimer(1, '11', 'Other UnitType'), createTimer(2, '', 'IC'), createTimer(0, '', 'Personnel')];

    const { getByText, queryByText, getByTestId, unmount } = render(<CheckInTabContent callId={1} />);

    expect(getByText('Matching UnitType')).toBeTruthy();
    expect(getByText('Personnel')).toBeTruthy();
    expect(queryByText('Other UnitType')).toBeNull();
    expect(queryByText('IC')).toBeNull();
    expect(getByTestId('quick-check-in-button')).toBeTruthy();
    unmount();
  });

  it('hides Quick Check-In when only non-identity check-in types are available', () => {
    mockTimerStatuses = [createTimer(3, '', 'PAR')];

    const { getByText, queryByTestId, unmount } = render(<CheckInTabContent callId={1} />);

    expect(getByText('PAR')).toBeTruthy();
    expect(queryByTestId('quick-check-in-button')).toBeNull();
    unmount();
  });

  it('shows no timers when the user and unit type do not match', () => {
    mockActiveUnit = null;
    mockUserId = null;
    mockTimerStatuses = [createTimer(1, '10', 'UnitType'), createTimer(0, '', 'Personnel'), createTimer(2, '', 'IC')];

    const { getByText, queryByTestId, unmount } = render(<CheckInTabContent callId={1} />);

    expect(getByText('check_in.no_timers')).toBeTruthy();
    expect(queryByTestId('quick-check-in-button')).toBeNull();
    unmount();
  });
});
