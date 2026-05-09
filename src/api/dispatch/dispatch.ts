import { createApiEndpoint } from '@/api/common/client';
import { type GetSetUnitStateResult } from '@/models/v4/dispatch/getSetUnitStateResult';
import { type NewCallFormResult } from '@/models/v4/dispatch/newCallFormResult';

const getNewCallDataApi = createApiEndpoint('/Dispatch/GetNewCallData');
const getSetUnitStatusDataApi = createApiEndpoint('/Dispatch/GetSetUnitStatusData');

export const getNewCallData = async () => {
  const response = await getNewCallDataApi.get<NewCallFormResult>();
  return response.data;
};

export const getSetUnitStatusData = async (unitId: string) => {
  const response = await getSetUnitStatusDataApi.get<GetSetUnitStateResult>({
    unitId: unitId,
  });
  return response.data;
};

export const getSetUnitState = async (unitId: string) => {
  return getSetUnitStatusData(unitId);
};
