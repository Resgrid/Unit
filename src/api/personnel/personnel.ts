import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';
import { PersonnelInfoResult } from '@/models/v4/personnel/personnelInfoResult';
import { GetAllPersonnelInfosResult } from '@/models/v4/personnel/getAllPersonnelInfosResult';
import { GetPersonnelFilterOptionsResult } from '@/models/v4/personnel/getPersonnelFilterOptionsResult';

const getPersonnelInfoApi = createApiEndpoint('/Personnel/GetPersonnelInfo');

const getAllPersonnelInfosApi = createApiEndpoint(
  '/Personnel/GetAllPersonnelInfos'
);

const ugetPersonnelFilterOptionsApi = createCachedApiEndpoint(
  '/Personnel/GetPersonnelFilterOptions',
  {
    ttl: 60 * 1000 * 2880, // Cache for 2 days
    enabled: true,
  }
);

export const getPersonnelInfo = async (userId: string) => {
  const response = await getPersonnelInfoApi.get<PersonnelInfoResult>({
    userId: userId,
  });
  return response.data;
};

export const getAllPersonnelInfos = async (filter: string) => {
  if (filter) {
    const response =
      await getAllPersonnelInfosApi.get<GetAllPersonnelInfosResult>({
        params: {
          activeFilter: encodeURIComponent(filter),
        },
      });
    return response.data;
  }

  const response =
    await getAllPersonnelInfosApi.get<GetAllPersonnelInfosResult>();
  return response.data;
};

export const getUnitsFilterOptions = async () => {
  const response =
    await ugetPersonnelFilterOptionsApi.get<GetPersonnelFilterOptionsResult>();
  return response.data;
};
