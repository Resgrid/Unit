import { createCachedApiEndpoint } from '../common/cached-client';
import { GetConfigResult } from '@/models/v4/configs/getConfigResult';

const getConfigApi = createCachedApiEndpoint('/Config/GetConfig', {
  ttl: (60 * 1000) * 2880, // Cache for 2 days
  enabled: true,
});

export const getGroup = async (key: string) => {
  const response = await getConfigApi.get<GetConfigResult>({
    params: {
      key: encodeURIComponent(key)
    }
  });
  return response.data;
};
