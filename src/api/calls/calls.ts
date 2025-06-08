import { createCachedApiEndpoint } from '../common/cached-client';
import { ActiveCallsResult } from '@/models/v4/calls/activeCallsResult';
import { createApiEndpoint } from '../common/client';
import { CallExtraDataResult } from '@/models/v4/calls/callExtraDataResult';
import { CallResult } from '@/models/v4/calls/callResult';

const callsApi = createCachedApiEndpoint('/Calls/GetActiveCalls', {
  ttl: 60 * 1000, // Cache for 60 seconds
  enabled: true,
});

const getCallApi = createApiEndpoint('/Calls/GetCall');
const getCallExtraDataApi = createApiEndpoint('/Calls/GetCallExtraData');

export const getCalls = async () => {
  const response = await callsApi.get<ActiveCallsResult>();
  return response.data;
};

export const getCallExtraData = async (callId: string) => {
  const response = await getCallExtraDataApi.get<CallExtraDataResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export const getCall = async (callId: string) => {
  const response = await getCallApi.get<CallResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};
