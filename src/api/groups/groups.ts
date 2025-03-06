import { type GroupResult } from '@/models/v4/groups/groupResult';
import { type GroupsResult } from '@/models/v4/groups/groupsResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getAllGroupsApi = createCachedApiEndpoint('/Groups/GetAllGroups', {
  ttl: 60 * 1000 * 2880, // Cache for 2 days
  enabled: true,
});

const getGroupsApi = createApiEndpoint('/Groups/GetAllGroups');

export const getAllGroups = async () => {
  const response = await getAllGroupsApi.get<GroupsResult>();
  return response.data;
};

export const getGroup = async (groupId: string) => {
  const response = await getGroupsApi.get<GroupResult>({
    params: {
      groupId: encodeURIComponent(groupId),
    },
  });
  return response.data;
};
