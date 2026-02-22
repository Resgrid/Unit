import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitRoleResultData } from '@/models/v4/unitRoles/unitRoleResultData';

import { RoleAssignmentItem } from '../role-assignment-item';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, string>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (typeof defaultValue === 'object' && defaultValue.defaultValue) return defaultValue.defaultValue;
      return key;
    },
  }),
}));

// Mock nativewind
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock the RoleUserSelectionModal to simplify testing
let mockModalOnSelectUser: ((userId?: string) => void) | undefined;
jest.mock('../role-user-selection-modal', () => ({
  RoleUserSelectionModal: ({ isOpen, onClose, roleName, selectedUserId, users, onSelectUser }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    mockModalOnSelectUser = onSelectUser;
    if (!isOpen) return null;
    return (
      <View testID="user-selection-modal">
        <Text testID="modal-role-name">{roleName}</Text>
        <TouchableOpacity testID="select-unassigned" onPress={() => { onSelectUser(undefined); onClose(); }}>
          <Text>Unassigned</Text>
        </TouchableOpacity>
        {users.map((user: any) => (
          <TouchableOpacity key={user.UserId} testID={`select-user-${user.UserId}`} onPress={() => { onSelectUser(user.UserId); onClose(); }}>
            <Text>{`${user.FirstName} ${user.LastName}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  },
}));

// Mock UI components
jest.mock('@/components/ui/text', () => ({
  Text: ({ children, className, testID }: any) => {
    const { Text } = require('react-native');
    return <Text testID={testID || 'text'}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="vstack">{children}</View>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="hstack">{children}</View>;
  },
}));

describe('RoleAssignmentItem', () => {
  const mockOnAssignUser = jest.fn();

  const mockRole: UnitRoleResultData = {
    UnitRoleId: 'role1',
    Name: 'Captain',
    UnitId: 'unit1',
  };

  const mockUsers: PersonnelInfoResultData[] = [
    {
      UserId: 'user1',
      FirstName: 'John',
      LastName: 'Doe',
      EmailAddress: 'john.doe@example.com',
      DepartmentId: 'dept1',
      IdentificationNumber: '',
      MobilePhone: '',
      GroupId: 'group1',
      GroupName: 'Engine 1',
      StatusId: '',
      Status: 'Available',
      StatusColor: '#00ff00',
      StatusTimestamp: '',
      StatusDestinationId: '',
      StatusDestinationName: '',
      StaffingId: '',
      Staffing: 'On Shift',
      StaffingColor: '#0000ff',
      StaffingTimestamp: '',
      Roles: ['Firefighter'],
    },
    {
      UserId: 'user2',
      FirstName: 'Jane',
      LastName: 'Smith',
      EmailAddress: 'jane.smith@example.com',
      DepartmentId: 'dept1',
      IdentificationNumber: '',
      MobilePhone: '',
      GroupId: '',
      GroupName: '',
      StatusId: '',
      Status: '',
      StatusColor: '',
      StatusTimestamp: '',
      StatusDestinationId: '',
      StatusDestinationName: '',
      StaffingId: '',
      Staffing: '',
      StaffingColor: '',
      StaffingTimestamp: '',
      Roles: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockModalOnSelectUser = undefined;
  });

  it('renders the role name', () => {
    render(
      <RoleAssignmentItem
        role={mockRole}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    expect(screen.getByText('Captain')).toBeTruthy();
  });

  it('displays "Unassigned" when no user is assigned', () => {
    render(
      <RoleAssignmentItem
        role={mockRole}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    expect(screen.getByText('Unassigned')).toBeTruthy();
  });

  it('displays assigned user name inline when user is assigned', () => {
    const assignedUser = mockUsers[0];

    render(
      <RoleAssignmentItem
        role={mockRole}
        assignedUser={assignedUser}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('displays user details inline (group, status, staffing)', () => {
    const assignedUser = mockUsers[0];

    render(
      <RoleAssignmentItem
        role={mockRole}
        assignedUser={assignedUser}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    expect(screen.getByText('Engine 1')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('On Shift')).toBeTruthy();
  });

  it('opens selection modal on tap', () => {
    render(
      <RoleAssignmentItem
        role={mockRole}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    // Modal should not be visible initially
    expect(screen.queryByTestId('user-selection-modal')).toBeNull();

    // Tap the item
    fireEvent.press(screen.getByTestId('role-assignment-role1'));

    // Modal should now be visible
    expect(screen.getByTestId('user-selection-modal')).toBeTruthy();
    expect(screen.getByTestId('modal-role-name')).toBeTruthy();
  });

  it('shows all users including those assigned to other roles in the modal', () => {
    const currentAssignments = [
      { roleId: 'role2', userId: 'user2', roleName: 'Engineer' }, // user2 is assigned to a different role
    ];

    render(
      <RoleAssignmentItem
        role={mockRole}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={currentAssignments}
      />
    );

    // Open modal
    fireEvent.press(screen.getByTestId('role-assignment-role1'));

    // Should show both users (no filtering)
    expect(screen.getByTestId('select-user-user1')).toBeTruthy();
    expect(screen.getByTestId('select-user-user2')).toBeTruthy();
    // Unassigned option should always be present
    expect(screen.getByTestId('select-unassigned')).toBeTruthy();
  });

  it('shows all users in the modal including those assigned to same and other roles', () => {
    const assignedUser = mockUsers[0];
    const currentAssignments = [
      { roleId: 'role1', userId: 'user1', roleName: 'Captain' }, // user1 is assigned to this role
      { roleId: 'role2', userId: 'user2', roleName: 'Engineer' }, // user2 is assigned to a different role
    ];

    render(
      <RoleAssignmentItem
        role={mockRole}
        assignedUser={assignedUser}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={currentAssignments}
      />
    );

    // Open modal
    fireEvent.press(screen.getByTestId('role-assignment-role1'));

    // Should show both users (no filtering, all users visible)
    expect(screen.getByTestId('select-user-user1')).toBeTruthy();
    expect(screen.getByTestId('select-user-user2')).toBeTruthy();
  });

  it('calls onAssignUser when selecting a user in the modal', () => {
    render(
      <RoleAssignmentItem
        role={mockRole}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    // Open modal
    fireEvent.press(screen.getByTestId('role-assignment-role1'));

    // Select user1
    fireEvent.press(screen.getByTestId('select-user-user1'));

    expect(mockOnAssignUser).toHaveBeenCalledWith('user1');
  });

  it('calls onAssignUser with undefined when selecting Unassigned', () => {
    const assignedUser = mockUsers[0];

    render(
      <RoleAssignmentItem
        role={mockRole}
        assignedUser={assignedUser}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    // Open modal
    fireEvent.press(screen.getByTestId('role-assignment-role1'));

    // Select Unassigned
    fireEvent.press(screen.getByTestId('select-unassigned'));

    expect(mockOnAssignUser).toHaveBeenCalledWith(undefined);
  });

  it('has proper accessibility role on the pressable', () => {
    render(
      <RoleAssignmentItem
        role={mockRole}
        availableUsers={mockUsers}
        onAssignUser={mockOnAssignUser}
        currentAssignments={[]}
      />
    );

    const pressable = screen.getByTestId('role-assignment-role1');
    expect(pressable.props.accessibilityRole).toBe('button');
  });
});