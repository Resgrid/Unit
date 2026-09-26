jest.mock('@/api/personnel/personnel', () => ({ getAllPersonnelInfos: jest.fn() }));
jest.mock('@/api/units/unitRoles', () => ({
  getAllUnitRolesAndAssignmentsForDepartment: jest.fn(),
  getRoleAssignmentsForUnit: jest.fn(),
  setRoleAssignmentsForUnit: jest.fn(),
}));
jest.mock('@/stores/app/core-store', () => ({ useCoreStore: { getState: jest.fn(() => ({ activeUnitId: 'unit1' })) } }));

import { setRoleAssignmentsForUnit } from '@/api/units/unitRoles';

import { useRolesStore } from '../store';

const mockSetRoleAssignmentsForUnit = setRoleAssignmentsForUnit as jest.Mock;

const input = { UnitId: 'unit1', Roles: [{ RoleId: 'role1', UserId: 'user1', Name: '' }] };

describe('useRolesStore.assignRoles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRolesStore.setState({ isLoading: false, error: null });
  });

  it('saves the assignments and clears the loading flag', async () => {
    mockSetRoleAssignmentsForUnit.mockResolvedValue({});

    await expect(useRolesStore.getState().assignRoles(input as any)).resolves.toBeUndefined();

    expect(mockSetRoleAssignmentsForUnit).toHaveBeenCalledWith(input);
    expect(useRolesStore.getState().isLoading).toBe(false);
  });

  // Swallowing this made every failed save report "saved successfully".
  it('rethrows a failed save so the caller can report it', async () => {
    const failure = new Error('Request failed with status code 500');
    mockSetRoleAssignmentsForUnit.mockRejectedValue(failure);

    await expect(useRolesStore.getState().assignRoles(input as any)).rejects.toBe(failure);

    expect(useRolesStore.getState().isLoading).toBe(false);
    // `error` is the load-failure state the roles sheet shows instead of the list; a save failure
    // must not hide the crew's unsaved picks behind it.
    expect(useRolesStore.getState().error).toBeNull();
  });
});
