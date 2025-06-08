import { createCachedApiEndpoint } from '../common/cached-client';
import { UnitsResult } from '@/models/v4/units/unitsResult';
import { GetUnitFilterOptionsResult } from '@/models/v4/units/getUnitFilterOptionsResult';
import { UnitsInfoResult } from '@/models/v4/units/unitInfoResult';

const unitsApi = createCachedApiEndpoint('/Units/GetAllUnits', {
  ttl: (60 * 1000) * 2880, // Cache for 2 days
  enabled: true,
});

const unitsInfosApi = createCachedApiEndpoint('/Units/GetAllUnitsInfos', {
  ttl: (60 * 1000) * 2880, // Cache for 2 days
  enabled: true,
});

const unitsFilterOptionsApi = createCachedApiEndpoint('/Units/GetUnitsFilterOptions', {
  ttl: (60 * 1000) * 2880, // Cache for 2 days
  enabled: true,
});

export const getUnits = async () => {
  const response = await unitsApi.get<UnitsResult>();
  return response.data;
};

export const getUnitsInfos = async (filter: string) => {
  if (filter) {
    const response = await unitsInfosApi.get<UnitsInfoResult>({
      params: {
        activeFilter: encodeURIComponent(filter)
      }
    });
    return response.data;
  }

  const response = await unitsInfosApi.get<UnitsInfoResult>();
  return response.data;
};

export const getUnitsFilterOptions = async () => {
  const response = await unitsFilterOptionsApi.get<GetUnitFilterOptionsResult>();
  return response.data;
};