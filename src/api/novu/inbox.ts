import { createApiEndpoint } from '../common/client';

const getGroupsApi = createApiEndpoint('/Inbox/DeleteMessage');
const getUnitSubscriberHashApi = createApiEndpoint('/Inbox/GetUnitSubscriberHash');

export interface UnitSubscriberHashResult {
  Data: {
    UnitId: string;
    SubscriberHash?: string | null;
  };
}

// The inbox belongs to the active unit's Novu subscriber, so the server needs the unit to find the message.
// Without one it only looks in the signed-in user's own inbox and answers 404.
export const deleteMessage = async (messageId: string, unitId?: string | null) => {
  const response = await getGroupsApi.delete({
    messageId: encodeURIComponent(messageId),
    ...(unitId ? { unitId } : {}),
  });
  return response.data;
};

// The Novu subscriberHash for the unit's inbox ({DepartmentCode}_Unit_{unitId}). Novu refuses an inbox session
// without it once HMAC is enforced on the environment.
export const getUnitSubscriberHash = async (unitId: string) => {
  const response = await getUnitSubscriberHashApi.get<UnitSubscriberHashResult>({
    unitId,
  });
  return response.data;
};
