// Drives the sheet's own save handler (the other suite re-implements it), so a failed save is
// exercised end to end: it must be reported inside the sheet, not as a success.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { RolesBottomSheet } from '../roles-bottom-sheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, defaultValue?: string) => defaultValue || key }),
}));
jest.mock('nativewind', () => ({ styled: (component: any) => component, useColorScheme: () => ({ colorScheme: 'light' }), cssInterop: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => {
    const { View } = require('react-native');
    return isOpen ? <View testID="roles-bottom-sheet">{children}</View> : null;
  },
}));

// Each role row offers one pick, so a test can create an unsaved change.
jest.mock('../role-assignment-item', () => ({
  RoleAssignmentItem: ({ role, onAssignUser }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID={`assign-${role.UnitRoleId}`} onPress={() => onAssignUser('user2')}>
        <Text>{role.Name}</Text>
      </Pressable>
    );
  },
}));

const mockShowToast = jest.fn();
jest.mock('@/stores/toast/store', () => ({ useToastStore: { getState: () => ({ showToast: mockShowToast }) } }));

jest.mock('@/stores/app/core-store', () => {
  const activeUnit = { UnitId: 'unit1', Name: 'Engine 1' };
  return { useCoreStore: (selector: any) => selector({ activeUnit }) };
});

const mockAssignRoles = jest.fn();
const mockFetchRolesForUnit = jest.fn(async () => undefined);
const mockFetchAllForUnit = jest.fn(async () => undefined);
jest.mock('@/stores/roles/store', () => {
  const state = {
    roles: [
      { UnitRoleId: 'role1', Name: 'Captain', UnitId: 'unit1' },
      { UnitRoleId: 'role2', Name: 'Engineer', UnitId: 'unit1' },
    ],
    unitRoleAssignments: [],
    users: [
      { UserId: 'user1', FirstName: 'Ann', LastName: 'Lee' },
      { UserId: 'user2', FirstName: 'Bo', LastName: 'Ray' },
    ],
    isLoading: false,
    error: null,
  };
  const useRolesStore: any = (selector: any) => selector(state);
  useRolesStore.getState = () => ({ ...state, assignRoles: mockAssignRoles, fetchRolesForUnit: mockFetchRolesForUnit, fetchAllForUnit: mockFetchAllForUnit });
  return { useRolesStore };
});

const pressSave = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('save-button'));
  });
};

describe('RolesBottomSheet saving', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes with a success message when the save goes through', async () => {
    mockAssignRoles.mockResolvedValue(undefined);
    render(<RolesBottomSheet isOpen onClose={onClose} />);

    fireEvent.press(screen.getByTestId('assign-role1'));
    await pressSave();

    expect(mockAssignRoles).toHaveBeenCalledWith(expect.objectContaining({ UnitId: 'unit1', Roles: expect.arrayContaining([{ RoleId: 'role1', UserId: 'user2', Name: '' }]) }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('success', 'Role assignments saved successfully');
    expect(screen.queryByTestId('save-error-message')).toBeNull();
  });

  it('reports a failed save inside the sheet and keeps the picks for a retry', async () => {
    mockAssignRoles.mockRejectedValueOnce(new Error('Request failed with status code 500'));
    render(<RolesBottomSheet isOpen onClose={onClose} />);

    fireEvent.press(screen.getByTestId('assign-role1'));
    await pressSave();

    expect(screen.getByTestId('save-error-message')).toBeTruthy();
    expect(screen.getByText('Error saving role assignments')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();

    // Retry sends the same picks, and success clears the error and closes.
    mockAssignRoles.mockResolvedValueOnce(undefined);
    await pressSave();

    expect(mockAssignRoles).toHaveBeenCalledTimes(2);
    expect(mockAssignRoles.mock.calls[1][0]).toEqual(mockAssignRoles.mock.calls[0][0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears the save error once the crew changes a pick', async () => {
    mockAssignRoles.mockRejectedValueOnce(new Error('Network Error'));
    render(<RolesBottomSheet isOpen onClose={onClose} />);

    fireEvent.press(screen.getByTestId('assign-role1'));
    await pressSave();
    expect(screen.getByTestId('save-error-message')).toBeTruthy();

    fireEvent.press(screen.getByTestId('assign-role2'));

    expect(screen.queryByTestId('save-error-message')).toBeNull();
  });
});
