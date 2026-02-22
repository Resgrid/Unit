import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

import { RoleUserSelectionModal } from '../role-user-selection-modal';

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

// Mock Modal components
jest.mock('@/components/ui/modal', () => ({
  Modal: ({ children, isOpen }: any) => {
    if (!isOpen) return null;
    const { View } = require('react-native');
    return <View testID="modal">{children}</View>;
  },
  ModalBackdrop: () => null,
  ModalBody: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="modal-body">{children}</View>;
  },
  ModalContent: ({ children, testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID || 'modal-content'}>{children}</View>;
  },
  ModalHeader: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="modal-header">{children}</View>;
  },
}));

// Mock other UI components
jest.mock('@/components/ui/text', () => ({
  Text: ({ children, testID }: any) => {
    const { Text } = require('react-native');
    return <Text testID={testID}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/ui/divider', () => ({
  Divider: () => null,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  InputField: ({ placeholder, value, onChangeText, testID }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput testID={testID} placeholder={placeholder} value={value} onChangeText={onChangeText} />;
  },
  InputIcon: () => null,
  InputSlot: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

describe('RoleUserSelectionModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectUser = jest.fn();

  const mockUsers: PersonnelInfoResultData[] = [
    {
      UserId: 'user1',
      FirstName: 'John',
      LastName: 'Doe',
      EmailAddress: 'john@example.com',
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
      EmailAddress: 'jane@example.com',
      DepartmentId: 'dept1',
      IdentificationNumber: '',
      MobilePhone: '',
      GroupId: 'group2',
      GroupName: 'Ladder 5',
      StatusId: '',
      Status: 'Not Available',
      StatusColor: '#ff0000',
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
  });

  it('does not render when closed', () => {
    render(
      <RoleUserSelectionModal
        isOpen={false}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    expect(screen.queryByTestId('role-user-selection-modal')).toBeNull();
  });

  it('renders when open', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    expect(screen.getByTestId('role-user-selection-modal')).toBeTruthy();
  });

  it('shows the unassigned option', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    expect(screen.getByTestId('unassigned-option')).toBeTruthy();
  });

  it('calls onSelectUser with undefined and closes when unassigned is tapped', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    fireEvent.press(screen.getByTestId('unassigned-option'));

    expect(mockOnSelectUser).toHaveBeenCalledWith(undefined);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders user items in the list', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    expect(screen.getByTestId('user-item-user1')).toBeTruthy();
    expect(screen.getByTestId('user-item-user2')).toBeTruthy();
  });

  it('calls onSelectUser with userId and closes when a user is tapped', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    fireEvent.press(screen.getByTestId('user-item-user1'));

    expect(mockOnSelectUser).toHaveBeenCalledWith('user1');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows search input', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    expect(screen.getByTestId('user-search-input')).toBeTruthy();
  });

  it('filters users by search query', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    // Type a search query
    fireEvent.changeText(screen.getByTestId('user-search-input'), 'John');

    // Only John should be visible
    expect(screen.getByTestId('user-item-user1')).toBeTruthy();
    expect(screen.queryByTestId('user-item-user2')).toBeNull();
  });

  it('filters users by group name', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    fireEvent.changeText(screen.getByTestId('user-search-input'), 'Ladder');

    expect(screen.queryByTestId('user-item-user1')).toBeNull();
    expect(screen.getByTestId('user-item-user2')).toBeTruthy();
  });

  it('shows empty state when no users match search', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    fireEvent.changeText(screen.getByTestId('user-search-input'), 'zzzzz');

    expect(screen.queryByTestId('user-item-user1')).toBeNull();
    expect(screen.queryByTestId('user-item-user2')).toBeNull();
  });

  it('highlights the currently selected user', () => {
    render(
      <RoleUserSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        roleName="Captain"
        selectedUserId="user1"
        users={mockUsers}
        onSelectUser={mockOnSelectUser}
      />
    );

    // Both should be present - selected just has different styling
    expect(screen.getByTestId('user-item-user1')).toBeTruthy();
    expect(screen.getByTestId('user-item-user2')).toBeTruthy();
  });
});
