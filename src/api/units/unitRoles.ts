import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';
import { SetUnitRolesInput } from '@/models/v4/unitRoles/setUnitRolesInput';
import { UnitRolesForUnitResult } from '@/models/v4/unitRoles/unitRolesForUnitResult';
import { ActiveUnitRolesResult } from '@/models/v4/unitRoles/activeUnitRolesResult';
import { SetRoleAssignmentsForUnitResult } from '@/models/v4/unitRoles/setRoleAssignmentsForUnitResult';

const getRolesForUnitApi = createCachedApiEndpoint(
  '/UnitRoles/GetRolesForUnit',
  {
    ttl: 60 * 1000 * 2880, // Cache for 2 days
    enabled: true,
  }
);

const getRoleAssignmentsForUnitApi = createApiEndpoint(
  '/UnitRoles/GetRoleAssignmentsForUnit'
);
const setRoleAssignmentsForUnitApi = createApiEndpoint(
  '/Units/GetUnitsFilterOptions'
);
const getAllUnitRolesAndAssignmentsForDepartmentApi = createApiEndpoint(
  '/UnitRoles/GetAllUnitRolesAndAssignmentsForDepartment'
);

export const getRolesForUnit = async (unitId: string) => {
  const response = await getRolesForUnitApi.get<UnitRolesForUnitResult>({
    unitId: unitId,
  });
  return response.data;
};

export const getRoleAssignmentsForUnit = async (unitId: string) => {
  const response =
    await getRoleAssignmentsForUnitApi.get<ActiveUnitRolesResult>({
      unitId: unitId,
    });
  return response.data;
};

export const setRoleAssignmentsForUnit = async (data: SetUnitRolesInput) => {
  const response =
    await setRoleAssignmentsForUnitApi.post<SetRoleAssignmentsForUnitResult>({
      ...data,
    });
  return response.data;
};

export const getAllUnitRolesAndAssignmentsForDepartment = async () => {
  const response =
    await getAllUnitRolesAndAssignmentsForDepartmentApi.get<ActiveUnitRolesResult>();
  return response.data;
};
