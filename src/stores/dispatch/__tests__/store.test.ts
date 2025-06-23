import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';

import { useDispatchStore } from '../store';

// Mock the API modules
jest.mock('@/api/groups/groups');
jest.mock('@/api/personnel/personnel');
jest.mock('@/api/units/unitRoles');
jest.mock('@/api/units/units');

// Import the mocked modules
import { getAllGroups } from '@/api/groups/groups';
import { getAllPersonnelInfos } from '@/api/personnel/personnel';
import { getAllUnitRolesAndAssignmentsForDepartment } from '@/api/units/unitRoles';
import { getUnits } from '@/api/units/units';

// Get the mocked functions
const mockGetAllGroups = getAllGroups as jest.MockedFunction<typeof getAllGroups>;
const mockGetAllPersonnelInfos = getAllPersonnelInfos as jest.MockedFunction<typeof getAllPersonnelInfos>;
const mockGetAllUnitRoles = getAllUnitRolesAndAssignmentsForDepartment as jest.MockedFunction<typeof getAllUnitRolesAndAssignmentsForDepartment>;
const mockGetUnits = getUnits as jest.MockedFunction<typeof getUnits>;

const mockData = {
  users: [
    {
      UserId: '1',
      FirstName: 'John',
      LastName: 'Doe',
      EmailAddress: 'john.doe@example.com',
      GroupName: 'Group A',
      IdentificationNumber: '',
      DepartmentId: '',
      MobilePhone: '',
      GroupId: '',
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
    {
      UserId: '2',
      FirstName: 'Jane',
      LastName: 'Smith',
      EmailAddress: 'jane.smith@example.com',
      GroupName: 'Group B',
      IdentificationNumber: '',
      DepartmentId: '',
      MobilePhone: '',
      GroupId: '',
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
  ],
  groups: [
    { GroupId: '1', Name: 'Fire Department', TypeId: 1, Address: '', GroupType: 'Fire' },
    { GroupId: '2', Name: 'EMS Department', TypeId: 2, Address: '', GroupType: 'EMS' },
  ],
  roles: [
    { UnitRoleId: '1', Name: 'Captain', UnitId: '1', UserId: '1', FullName: 'John Doe', UpdatedOn: '2023-01-01T00:00:00Z' },
    { UnitRoleId: '2', Name: 'Lieutenant', UnitId: '1', UserId: '2', FullName: 'Jane Smith', UpdatedOn: '2023-01-01T00:00:00Z' },
  ],
  units: [
    {
      UnitId: '1',
      Name: 'Engine 1',
      GroupName: 'Station 1',
      DepartmentId: '',
      Type: '',
      TypeId: 0,
      CustomStatusSetId: '',
      GroupId: '',
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
    },
    {
      UnitId: '2',
      Name: 'Ladder 1',
      GroupName: 'Station 1',
      DepartmentId: '',
      Type: '',
      TypeId: 0,
      CustomStatusSetId: '',
      GroupId: '',
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
    },
  ],
};

describe('useDispatchStore', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup successful responses with proper BaseV4Request structure
    mockGetAllPersonnelInfos.mockResolvedValue({
      Data: mockData.users,
      PageSize: 0,
      Timestamp: '',
      Version: '',
      Node: '',
      RequestId: '',
      Status: '',
      Environment: '',
    });

    mockGetAllGroups.mockResolvedValue({
      Data: mockData.groups,
      PageSize: 0,
      Timestamp: '',
      Version: '',
      Node: '',
      RequestId: '',
      Status: '',
      Environment: '',
    });

    mockGetAllUnitRoles.mockResolvedValue({
      Data: mockData.roles,
      PageSize: 0,
      Timestamp: '',
      Version: '',
      Node: '',
      RequestId: '',
      Status: '',
      Environment: '',
    });

    mockGetUnits.mockResolvedValue({
      Data: mockData.units,
      PageSize: 0,
      Timestamp: '',
      Version: '',
      Node: '',
      RequestId: '',
      Status: '',
      Environment: '',
    });
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useDispatchStore());

    expect(result.current.data).toEqual({
      users: [],
      groups: [],
      roles: [],
      units: [],
    });

    expect(result.current.selection).toEqual({
      everyone: false,
      users: [],
      groups: [],
      roles: [],
      units: [],
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.searchQuery).toBe('');
  });

  it('should fetch dispatch data successfully', async () => {
    const { result } = renderHook(() => useDispatchStore());

    await act(async () => {
      await result.current.fetchDispatchData();
    });

    expect(mockGetAllPersonnelInfos).toHaveBeenCalledWith('');
    expect(mockGetAllGroups).toHaveBeenCalled();
    expect(mockGetAllUnitRoles).toHaveBeenCalled();
    expect(mockGetUnits).toHaveBeenCalled();

    expect(result.current.data).toEqual({
      users: mockData.users,
      groups: mockData.groups,
      roles: mockData.roles,
      units: mockData.units,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const { result } = renderHook(() => useDispatchStore());

    mockGetAllPersonnelInfos.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await result.current.fetchDispatchData();
    });

    expect(result.current.error).toBe('Failed to fetch dispatch data');
    expect(result.current.isLoading).toBe(false);
  });

  it('should toggle everyone selection correctly', () => {
    const { result } = renderHook(() => useDispatchStore());

    // Initially everyone is false
    expect(result.current.selection.everyone).toBe(false);

    // Toggle everyone to true
    act(() => {
      result.current.toggleEveryone();
    });

    expect(result.current.selection.everyone).toBe(true);
    expect(result.current.selection.users).toEqual([]);
    expect(result.current.selection.groups).toEqual([]);
    expect(result.current.selection.roles).toEqual([]);
    expect(result.current.selection.units).toEqual([]);

    // Toggle everyone back to false
    act(() => {
      result.current.toggleEveryone();
    });

    expect(result.current.selection.everyone).toBe(false);
  });

  it('should toggle user selection and deselect everyone', () => {
    const { result } = renderHook(() => useDispatchStore());

    // First select everyone
    act(() => {
      result.current.toggleEveryone();
    });
    expect(result.current.selection.everyone).toBe(true);

    // Now select a user - should deselect everyone
    act(() => {
      result.current.toggleUser('1');
    });

    expect(result.current.selection.everyone).toBe(false);
    expect(result.current.selection.users).toEqual(['1']);

    // Toggle the same user again - should deselect
    act(() => {
      result.current.toggleUser('1');
    });

    expect(result.current.selection.users).toEqual([]);
  });

  it('should toggle group selection and deselect everyone', () => {
    const { result } = renderHook(() => useDispatchStore());

    // First select everyone
    act(() => {
      result.current.toggleEveryone();
    });
    expect(result.current.selection.everyone).toBe(true);

    // Now select a group - should deselect everyone
    act(() => {
      result.current.toggleGroup('1');
    });

    expect(result.current.selection.everyone).toBe(false);
    expect(result.current.selection.groups).toEqual(['1']);

    // Toggle the same group again - should deselect
    act(() => {
      result.current.toggleGroup('1');
    });

    expect(result.current.selection.groups).toEqual([]);
  });

  it('should toggle role selection and deselect everyone', () => {
    const { result } = renderHook(() => useDispatchStore());

    act(() => {
      result.current.toggleRole('1');
    });

    expect(result.current.selection.everyone).toBe(false);
    expect(result.current.selection.roles).toEqual(['1']);

    // Toggle the same role again - should deselect
    act(() => {
      result.current.toggleRole('1');
    });

    expect(result.current.selection.roles).toEqual([]);
  });

  it('should toggle unit selection and deselect everyone', () => {
    const { result } = renderHook(() => useDispatchStore());

    act(() => {
      result.current.toggleUnit('1');
    });

    expect(result.current.selection.everyone).toBe(false);
    expect(result.current.selection.units).toEqual(['1']);

    // Toggle the same unit again - should deselect
    act(() => {
      result.current.toggleUnit('1');
    });

    expect(result.current.selection.units).toEqual([]);
  });

  it('should set search query', () => {
    const { result } = renderHook(() => useDispatchStore());

    act(() => {
      result.current.setSearchQuery('test');
    });

    expect(result.current.searchQuery).toBe('test');
  });

  it('should clear selection', () => {
    const { result } = renderHook(() => useDispatchStore());

    // First make some selections
    act(() => {
      result.current.toggleUser('1');
      result.current.toggleGroup('1');
    });

    expect(result.current.selection.users).toEqual(['1']);
    expect(result.current.selection.groups).toEqual(['1']);

    // Clear selection
    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selection).toEqual({
      everyone: false,
      users: [],
      groups: [],
      roles: [],
      units: [],
    });
  });

  it('should filter data based on search query', async () => {
    const { result } = renderHook(() => useDispatchStore());

    // First fetch data
    await act(async () => {
      await result.current.fetchDispatchData();
    });

    // Set search query
    act(() => {
      result.current.setSearchQuery('john');
    });

    const filteredData = result.current.getFilteredData();

    // Should only return John Doe
    expect(filteredData.users).toHaveLength(1);
    expect(filteredData.users[0].FirstName).toBe('John');

    // Other arrays should be empty since no matches for "john"
    expect(filteredData.groups).toHaveLength(0);
    expect(filteredData.roles).toHaveLength(0);
    expect(filteredData.units).toHaveLength(0);
  });

  it('should filter groups based on search query', async () => {
    const { result } = renderHook(() => useDispatchStore());

    await act(async () => {
      await result.current.fetchDispatchData();
    });

    act(() => {
      result.current.setSearchQuery('fire');
    });

    const filteredData = result.current.getFilteredData();

    expect(filteredData.groups).toHaveLength(1);
    expect(filteredData.groups[0].Name).toBe('Fire Department');
  });

  it('should filter roles based on search query', async () => {
    const { result } = renderHook(() => useDispatchStore());

    await act(async () => {
      await result.current.fetchDispatchData();
    });

    act(() => {
      result.current.setSearchQuery('captain');
    });

    const filteredData = result.current.getFilteredData();

    expect(filteredData.roles).toHaveLength(1);
    expect(filteredData.roles[0].Name).toBe('Captain');
  });

  it('should filter units based on search query', async () => {
    const { result } = renderHook(() => useDispatchStore());

    await act(async () => {
      await result.current.fetchDispatchData();
    });

    act(() => {
      result.current.setSearchQuery('engine');
    });

    const filteredData = result.current.getFilteredData();

    expect(filteredData.units).toHaveLength(1);
    expect(filteredData.units[0].Name).toBe('Engine 1');
  });

  it('should return all data when search query is empty', async () => {
    const { result } = renderHook(() => useDispatchStore());

    await act(async () => {
      await result.current.fetchDispatchData();
    });

    act(() => {
      result.current.setSearchQuery('');
    });

    const filteredData = result.current.getFilteredData();

    expect(filteredData).toEqual({
      users: mockData.users,
      groups: mockData.groups,
      roles: mockData.roles,
      units: mockData.units,
    });
  });

  it('should set selection manually', () => {
    const { result } = renderHook(() => useDispatchStore());

    const newSelection = {
      everyone: false,
      users: ['1', '2'],
      groups: ['1'],
      roles: [],
      units: ['1'],
    };

    act(() => {
      result.current.setSelection(newSelection);
    });

    expect(result.current.selection).toEqual(newSelection);
  });
});
