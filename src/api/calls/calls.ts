import { type ActiveCallsResult } from '@/models/v4/calls/activeCallsResult';
import { type CallExtraDataResult } from '@/models/v4/calls/callExtraDataResult';
import { type CallResult } from '@/models/v4/calls/callResult';
import { type SaveCallResult } from '@/models/v4/calls/saveCallResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const callsApi = createCachedApiEndpoint('/Calls/GetActiveCalls', {
  ttl: 60 * 1000, // Cache for 60 seconds
  enabled: true,
});

const getCallApi = createApiEndpoint('/Calls/GetCall');
const getCallExtraDataApi = createApiEndpoint('/Calls/GetCallExtraData');
const createCallApi = createApiEndpoint('/Calls/CreateCall');

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

export interface CreateCallRequest {
  name: string;
  nature: string;
  note?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  priority: number;
  type?: string;
  contactName?: string;
  contactInfo?: string;
  what3words?: string;
  dispatchUsers?: string[];
  dispatchGroups?: string[];
  dispatchRoles?: string[];
  dispatchUnits?: string[];
  dispatchEveryone?: boolean;
}

export const createCall = async (callData: CreateCallRequest) => {
  let dispatchList = '';

  if (callData.dispatchEveryone) {
    dispatchList = 'Everyone';
  } else {
    if (callData.dispatchUsers) {
      dispatchList = callData.dispatchUsers.join(',');
    }
    if (callData.dispatchGroups) {
      dispatchList = callData.dispatchGroups.join(',');
    }
  }

  const data = {
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    Latitude: callData.latitude?.toString() || '',
    Longitude: callData.longitude?.toString() || '',
    Priority: callData.priority,
    Type: callData.type || '',
    ContactName: callData.contactName || '',
    ContactInfo: callData.contactInfo || '',
    What3Words: callData.what3words || '',
    DispatchUsers: callData.dispatchUsers || [],
    DispatchGroups: callData.dispatchGroups || [],
    DispatchRoles: callData.dispatchRoles || [],
    DispatchUnits: callData.dispatchUnits || [],
    DispatchEveryone: callData.dispatchEveryone || false,
  };

  const response = await createCallApi.post<SaveCallResult>(data);
  return response.data;
};
