jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((specifics: any) => specifics.ios || specifics.default),
    Version: 17,
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockPerformCheckIn = jest.fn() as any;
const mockShowToast = jest.fn() as any;

jest.mock('@/stores/check-in-timers/store', () => ({
  useCheckInTimerStore: jest.fn((selector: any) =>
    selector({
      isCheckingIn: false,
      performCheckIn: mockPerformCheckIn,
    })
  ),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn((selector: any) =>
    selector({
      activeUnit: { UnitId: '42' },
    })
  ),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn((selector: any) =>
    selector({
      latitude: 40.7128,
      longitude: -74.006,
    })
  ),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn((selector: any) =>
    selector({
      showToast: mockShowToast,
    })
  ),
}));

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { useQuickCheckIn } from '../use-quick-check-in';

describe('useQuickCheckIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should auto-detect Unit type when active unit exists', async () => {
    mockPerformCheckIn.mockResolvedValue(true);

    const { result } = renderHook(() => useQuickCheckIn(123));

    await act(async () => {
      await result.current.quickCheckIn();
    });

    expect(mockPerformCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        CallId: 123,
        CheckInType: 1, // Unit type
        UnitId: 42,
        Latitude: '40.7128',
        Longitude: '-74.006',
      })
    );
  });

  it('should show success toast on successful check-in', async () => {
    mockPerformCheckIn.mockResolvedValue(true);

    const { result } = renderHook(() => useQuickCheckIn(123));

    await act(async () => {
      await result.current.quickCheckIn();
    });

    expect(mockShowToast).toHaveBeenCalledWith('success', 'check_in.check_in_success');
  });

  it('should show error toast on failed check-in', async () => {
    mockPerformCheckIn.mockResolvedValue(false);

    const { result } = renderHook(() => useQuickCheckIn(123));

    await act(async () => {
      await result.current.quickCheckIn();
    });

    expect(mockShowToast).toHaveBeenCalledWith('error', 'check_in.check_in_error');
  });
});
