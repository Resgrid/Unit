import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { useCoreStore } from '@/stores/app/core-store';

import Sidebar from '../sidebar-content';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.test'),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

const mockSetIsOpen = jest.fn();
jest.mock('@/stores/status/store', () => ({
  useStatusBottomSheetStore: (selector: (state: { setIsOpen: jest.Mock }) => unknown) => selector({ setIsOpen: mockSetIsOpen }),
}));

const mockShowToast = jest.fn();
jest.mock('@/stores/toast/store', () => ({
  useToastStore: (selector: (state: { showToast: jest.Mock }) => unknown) => selector({ showToast: mockShowToast }),
}));

jest.mock('@/stores/feature-flags/store', () => ({
  useIsChatEnabled: () => false,
  useIsChecklistsEnabled: () => false,
  useIsDeploymentsEnabled: () => false,
  useIsRecordsFieldEnabled: () => false,
}));

jest.mock('../call-sidebar', () => ({ SidebarCallCard: () => null }));
jest.mock('../check-in-sidebar-widget', () => ({ CheckInSidebarWidget: () => null }));
jest.mock('../roles-sidebar', () => ({ SidebarRolesCard: () => null }));
jest.mock('../status-sidebar', () => ({ SidebarStatusCard: () => null }));
jest.mock('../unit-sidebar', () => ({ SidebarUnitCard: () => null }));
jest.mock('../../common/zero-state', () => ({ __esModule: true, default: () => null }));

jest.mock('@/components/status/hold-to-confirm-button', () => ({
  HoldToConfirmButton: ({ children, testID, onConfirm, backgroundColor, foregroundColor }: any) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable testID={testID} onPress={onConfirm} accessibilityHint={`${backgroundColor}|${foregroundColor}`}>
        {children}
      </Pressable>
    );
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, testID, onPress, style }: any) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable testID={testID} onPress={onPress} style={style}>
        {children}
      </Pressable>
    );
  },
  ButtonText: ({ children, style }: any) => {
    const { Text } = require('react-native');
    return <Text style={style}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, style }: any) => {
    const { Text } = require('react-native');
    return <Text style={style}>{children}</Text>;
  },
}));

const mockUseCoreStore = useCoreStore as unknown as jest.Mock;

const available = { Id: 10, Text: 'Available', BColor: '#449d44', NextIds: [11], Detail: 0, Note: 0 };
const responding = { Id: 11, Text: 'Responding', BColor: '', NextIds: [] as number[], Detail: 0, Note: 0 };
const outOfService = { Id: 12, Text: 'Out of Service', BColor: '#262626', NextIds: [] as number[], Detail: 0, Note: 0 };

const setCoreState = ({ holdMode, currentStateId }: { holdMode: boolean; currentStateId?: number }) => {
  const state = {
    activeStatuses: { Statuses: [available, responding, outOfService] },
    activeUnitStatus: currentStateId == null ? null : { UnitId: '1', StateId: currentStateId, State: '' },
    activeUnitId: '1',
    config: { StatusHoldToConfirm: holdMode },
  };
  mockUseCoreStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state));
};

const flattenStyle = (style: unknown) => require('react-native').StyleSheet.flatten(style);

describe('Sidebar status buttons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a status without a color on a white button with dark text instead of throwing', () => {
    setCoreState({ holdMode: false });

    const { unmount } = render(<Sidebar />);

    const button = screen.getByTestId('sidebar-status-11');
    expect(flattenStyle(button.props.style).backgroundColor).toBe('#ffffff');
    expect(flattenStyle(screen.getByText('Responding').props.style).color).toBe('#000000');
    // Colored statuses keep their own background.
    expect(flattenStyle(screen.getByTestId('sidebar-status-10').props.style).backgroundColor).toBe('#449d44');

    fireEvent.press(button);
    expect(mockSetIsOpen).toHaveBeenCalledWith(true, responding);

    unmount();
  });

  it('gives a hold button for a status without a color the same white fallback', () => {
    setCoreState({ holdMode: true });

    const { unmount } = render(<Sidebar />);

    expect(screen.getByTestId('sidebar-status-hold-11').props.accessibilityHint).toBe('#ffffff|#000000');

    fireEvent.press(screen.getByTestId('sidebar-status-hold-11'));
    expect(mockSetIsOpen).toHaveBeenCalledWith(true, responding, { holdConfirmed: true });

    unmount();
  });

  it('narrows the buttons to the current status next statuses until all are asked for', () => {
    setCoreState({ holdMode: false, currentStateId: 10 });

    const { unmount } = render(<Sidebar />);

    expect(screen.getByTestId('sidebar-status-11')).toBeTruthy();
    expect(screen.queryByTestId('sidebar-status-12')).toBeNull();

    fireEvent.press(screen.getByTestId('sidebar-status-show-all'));

    expect(screen.getByTestId('sidebar-status-12')).toBeTruthy();
    expect(screen.getByTestId('sidebar-status-show-next')).toBeTruthy();

    unmount();
  });

  it.each([false, true])('rings only the current status, without a "Current" badge (hold mode: %s)', (holdMode) => {
    setCoreState({ holdMode, currentStateId: 10 });

    const { unmount } = render(<Sidebar />);
    fireEvent.press(screen.getByTestId('sidebar-status-show-all'));

    expect(screen.getByTestId('sidebar-status-current-ring-10')).toBeTruthy();
    expect(screen.queryByTestId('sidebar-status-current-ring-11')).toBeNull();
    expect(screen.queryByTestId('sidebar-status-current-ring-12')).toBeNull();
    expect(screen.queryByText('status.current')).toBeNull();

    unmount();
  });
});
