import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { useAnalytics } from '@/hooks/use-analytics';
import { useCoreStore } from '@/stores/app/core-store';
import { useRolesStore } from '@/stores/roles/store';
import { useToastStore } from '@/stores/toast/store';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitResultData } from '@/models/v4/units/unitResultData';
import { type UnitRoleResultData } from '@/models/v4/unitRoles/unitRoleResultData';
import { type ActiveUnitRoleResultData } from '@/models/v4/unitRoles/activeUnitRoleResultData';

import { RolesBottomSheet } from '../roles-bottom-sheet';

// Mock the stores
jest.mock('@/stores/app/core-store');
jest.mock('@/stores/roles/store');
jest.mock('@/stores/toast/store');

// Mock use-analytics hook
jest.mock('@/hooks/use-analytics');

// Mock the CustomBottomSheet component
jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => {
    if (!isOpen) return null;
    return <div>{children}</div>;
  },
}));

// Mock the RoleAssignmentItem component
jest.mock('../role-assignment-item', () => ({
  RoleAssignmentItem: ({ role }: any) => {
    const { Text } = require('react-native');
    return (
      <Text testID={`role-item-${role.Name}`}>Role: {role.Name}</Text>
    );
  },
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

// Mock nativewind
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockUseRolesStore = useRolesStore as jest.MockedFunction<typeof useRolesStore>;
const mockUseToastStore = useToastStore as jest.MockedFunction<typeof useToastStore>;

describe('RolesBottomSheet', () => {
  const mockOnClose = jest.fn();
  const mockFetchRolesForUnit = jest.fn();
  const mockFetchUsers = jest.fn();
  const mockAssignRoles = jest.fn();
  const mockShowToast = jest.fn();
  const mockTrackEvent = jest.fn();

  const mockActiveUnit: UnitResultData = {
    UnitId: 'unit1',
    Name: 'Unit 1',
    Type: 'Engine',
    DepartmentId: 'dept1',
    TypeId: 1,
    CustomStatusSetId: '',
    GroupId: '',
    GroupName: '',
    Vin: '',
    PlateNumber: '',
    FourWheelDrive: false,
    SpecialPermit: false,
    CurrentDestinationId: '',
    CurrentStatusId: '',
    CurrentStatusTimestamp: '',
    Latitude: '',
    Longitude: '',
    Note: '',
  };

  const mockRoles: UnitRoleResultData[] = [
    {
      UnitRoleId: 'role1',
      Name: 'Captain',
      UnitId: 'unit1',
    },
    {
      UnitRoleId: 'role2',
      Name: 'Engineer',
      UnitId: 'unit1',
    },
  ];

  const mockUsers: PersonnelInfoResultData[] = [
    {
      UserId: 'user1',
      FirstName: 'John',
      LastName: 'Doe',
      EmailAddress: 'john.doe@example.com',
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

  const mockUnitRoleAssignments: ActiveUnitRoleResultData[] = [
    {
      UnitRoleId: 'role1',
      UnitId: 'unit1',
      Name: 'Captain',
      UserId: 'user1',
      FullName: 'John Doe',
      UpdatedOn: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup analytics mock
    (useAnalytics as jest.MockedFunction<typeof useAnalytics>).mockReturnValue({
      trackEvent: mockTrackEvent,
    });

    mockUseCoreStore.mockReturnValue(mockActiveUnit);
    mockUseRolesStore.mockReturnValue({
      roles: mockRoles,
      unitRoleAssignments: mockUnitRoleAssignments,
      users: mockUsers,
      isLoading: false,
      error: null,
      fetchRolesForUnit: mockFetchRolesForUnit,
      fetchUsers: mockFetchUsers,
      assignRoles: mockAssignRoles,
    } as any);

    mockUseToastStore.mockReturnValue({
      showToast: mockShowToast,
    } as any);

    // Mock the getState functions
    useRolesStore.getState = jest.fn().mockReturnValue({
      fetchRolesForUnit: mockFetchRolesForUnit,
      fetchUsers: mockFetchUsers,
      assignRoles: mockAssignRoles,
    });

    useToastStore.getState = jest.fn().mockReturnValue({
      showToast: mockShowToast,
    });
  });

  it('renders correctly when opened', () => {
    render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Unit Role Assignments')).toBeTruthy();
    expect(screen.getByText('Unit 1')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('does not render when not opened', () => {
    render(<RolesBottomSheet isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByText('Unit Role Assignments')).toBeNull();
  });

  it('fetches roles and users when opened', () => {
    render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

    expect(mockFetchRolesForUnit).toHaveBeenCalledWith('unit1');
    expect(mockFetchUsers).toHaveBeenCalled();
  });

  it('renders role assignment items', () => {
    render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByTestId('role-item-Captain')).toBeTruthy();
    expect(screen.getByTestId('role-item-Engineer')).toBeTruthy();
  });

  it('displays error state correctly', () => {
    const errorMessage = 'Failed to load roles';
    mockUseRolesStore.mockReturnValue({
      roles: [],
      unitRoleAssignments: [],
      users: [],
      isLoading: false,
      error: errorMessage,
      fetchRolesForUnit: mockFetchRolesForUnit,
      fetchUsers: mockFetchUsers,
      assignRoles: mockAssignRoles,
    } as any);

    render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText(errorMessage)).toBeTruthy();
  });

  it('handles missing active unit gracefully', () => {
    mockUseCoreStore.mockReturnValue(null);

    render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Unit Role Assignments')).toBeTruthy();
    expect(screen.queryByText('Unit 1')).toBeNull();
  });

  it('filters roles by active unit', () => {
    const rolesWithDifferentUnits = [
      ...mockRoles,
      {
        UnitRoleId: 'role3',
        Name: 'Chief',
        UnitId: 'unit2', // Different unit
      },
    ];

    mockUseRolesStore.mockReturnValue({
      roles: rolesWithDifferentUnits,
      unitRoleAssignments: mockUnitRoleAssignments,
      users: mockUsers,
      isLoading: false,
      error: null,
      fetchRolesForUnit: mockFetchRolesForUnit,
      fetchUsers: mockFetchUsers,
      assignRoles: mockAssignRoles,
    } as any);

    render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

    // Should only show roles for the active unit
    expect(screen.getByTestId('role-item-Captain')).toBeTruthy();
    expect(screen.getByTestId('role-item-Engineer')).toBeTruthy();
    expect(screen.queryByTestId('role-item-Chief')).toBeNull();
  });

  it('has functional buttons', () => {
    render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  describe('User assignment bug fixes', () => {
    it('should prevent duplicate role assignments for roles with same name', () => {
      // Add roles with same name but different IDs to test the fix
      const rolesWithSameName: UnitRoleResultData[] = [
        {
          UnitRoleId: 'role-1',
          UnitId: 'unit1',
          Name: 'Firefighter',
        },
        {
          UnitRoleId: 'role-2',
          UnitId: 'unit1',
          Name: 'Firefighter', // Same name, different ID
        },
      ];

      mockUseRolesStore.mockReturnValue({
        roles: rolesWithSameName,
        unitRoleAssignments: [],
        users: mockUsers,
        isLoading: false,
        error: null,
        fetchRolesForUnit: mockFetchRolesForUnit,
        fetchUsers: mockFetchUsers,
        assignRoles: mockAssignRoles,
      } as any);

      render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

      // Both roles should be rendered with distinct IDs
      const firefighterRoles = screen.getAllByTestId(/role-item-Firefighter/);
      expect(firefighterRoles).toHaveLength(2);
    });

    it('should handle empty user assignments correctly', () => {
      // Test with assignments that have empty user IDs
      const assignmentsWithEmpty: ActiveUnitRoleResultData[] = [
        {
          UnitRoleId: 'role1',
          UnitId: 'unit1',
          UserId: 'user1',
          Name: 'Captain',
          FullName: 'John Doe',
          UpdatedOn: new Date().toISOString(),
        },
        {
          UnitRoleId: 'role2',
          UnitId: 'unit1',
          UserId: '', // Empty user ID
          Name: 'Engineer',
          FullName: '',
          UpdatedOn: new Date().toISOString(),
        },
      ];

      mockUseRolesStore.mockReturnValue({
        roles: mockRoles,
        unitRoleAssignments: assignmentsWithEmpty,
        users: mockUsers,
        isLoading: false,
        error: null,
        fetchRolesForUnit: mockFetchRolesForUnit,
        fetchUsers: mockFetchUsers,
        assignRoles: mockAssignRoles,
      } as any);

      render(<RolesBottomSheet isOpen={true} onClose={mockOnClose} />);

      // Component should render without errors despite empty user assignments
      expect(screen.getByText('Unit Role Assignments')).toBeTruthy();
    });
  });
}); 