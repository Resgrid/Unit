import { createCachedApiEndpoint } from '../common/cached-client';
import { DepartmentRightsResult } from '@/models/v4/security/departmentRightsResult';

const getCurrentUsersRightsApi = createCachedApiEndpoint(
  '/Security/GetCurrentUsersRights',
  {
    ttl: 60 * 1000 * 2880, // Cache for 2 days
    enabled: true,
  }
);

export const getCurrentUsersRights = async () => {
  const response = await getCurrentUsersRightsApi.get<DepartmentRightsResult>();
  return response.data;
};
