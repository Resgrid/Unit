import { type CallProtocolsResult } from '@/models/v4/callProtocols/callProtocolsResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getAllProtocolsApi = createCachedApiEndpoint('/Protocols/GetAllProtocols', {
  ttl: 60 * 1000 * 2880, // Cache for 2 days
  enabled: true,
});

const getProtocolApi = createApiEndpoint('/Protocols/GetProtocol');

export const getAllProtocols = async () => {
  const response = await getAllProtocolsApi.get<CallProtocolsResult>();
  return response.data;
};

export const getProtocol = async (protocolId: string) => {
  const response = await getProtocolApi.get<CallProtocolsResult>({
    protocolId,
  });
  return response.data;
};
