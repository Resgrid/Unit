import { cacheManager } from '@/lib/cache/cache-manager';
import { type ActiveCallsResult } from '@/models/v4/calls/activeCallsResult';
import { type CallExtraDataResult } from '@/models/v4/calls/callExtraDataResult';
import { type CallResult } from '@/models/v4/calls/callResult';
import { type SaveCallResult } from '@/models/v4/calls/saveCallResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const callsApi = createCachedApiEndpoint('/Calls/GetActiveCalls', {
  ttl: 30 * 1000, // Cache for 30 seconds - calls can change frequently
  enabled: true,
});
const getCallApi = createApiEndpoint('/Calls/GetCall');
const getCallExtraDataApi = createApiEndpoint('/Calls/GetCallExtraData');
const createCallApi = createApiEndpoint('/Calls/SaveCall');
const updateCallApi = createApiEndpoint('/Calls/UpdateCall');
const closeCallApi = createApiEndpoint('/Calls/CloseCall');

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
  plusCode?: string;
  dispatchUsers?: string[];
  dispatchGroups?: string[];
  dispatchRoles?: string[];
  dispatchUnits?: string[];
  dispatchEveryone?: boolean;
}

export interface UpdateCallRequest {
  callId: string;
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
  plusCode?: string;
  dispatchUsers?: string[];
  dispatchGroups?: string[];
  dispatchRoles?: string[];
  dispatchUnits?: string[];
  dispatchEveryone?: boolean;
}

export interface CloseCallRequest {
  callId: string;
  type: number;
  note?: string;
}

/**
 * Helper function to build the dispatch list string from dispatch data
 */
const buildDispatchList = (data: { dispatchEveryone?: boolean; dispatchUsers?: string[]; dispatchGroups?: string[]; dispatchRoles?: string[]; dispatchUnits?: string[] }): string => {
  if (data.dispatchEveryone) {
    return '0';
  }

  const dispatchEntries: string[] = [];

  if (data.dispatchUsers) {
    dispatchEntries.push(...data.dispatchUsers);
  }
  if (data.dispatchGroups) {
    dispatchEntries.push(...data.dispatchGroups);
  }
  if (data.dispatchRoles) {
    dispatchEntries.push(...data.dispatchRoles);
  }
  if (data.dispatchUnits) {
    dispatchEntries.push(...data.dispatchUnits);
  }

  return dispatchEntries.join('|');
};

export const createCall = async (callData: CreateCallRequest) => {
  const dispatchList = buildDispatchList(callData);

  const data = {
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    Geolocation: `${callData.latitude?.toString() || ''},${callData.longitude?.toString() || ''}`,
    Priority: callData.priority,
    Type: callData.type || '',
    ContactName: callData.contactName || '',
    ContactInfo: callData.contactInfo || '',
    What3Words: callData.what3words || '',
    PlusCode: callData.plusCode || '',
    DispatchList: dispatchList,
  };

  const response = await createCallApi.post<SaveCallResult>(data);

  // Invalidate cache after successful mutation
  try {
    cacheManager.remove('/Calls/GetActiveCalls');
  } catch (error) {
    // Silently handle cache removal errors
    console.warn('Failed to invalidate calls cache:', error);
  }

  return response.data;
};

export const updateCall = async (callData: UpdateCallRequest) => {
  const dispatchList = buildDispatchList(callData);

  const data = {
    CallId: callData.callId,
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    Geolocation: `${callData.latitude?.toString() || ''},${callData.longitude?.toString() || ''}`,
    Priority: callData.priority,
    Type: callData.type || '',
    ContactName: callData.contactName || '',
    ContactInfo: callData.contactInfo || '',
    What3Words: callData.what3words || '',
    PlusCode: callData.plusCode || '',
    DispatchList: dispatchList,
  };

  const response = await updateCallApi.post<SaveCallResult>(data);

  // Invalidate cache after successful mutation
  try {
    cacheManager.remove('/Calls/GetActiveCalls');
  } catch (error) {
    // Silently handle cache removal errors
    console.warn('Failed to invalidate calls cache:', error);
  }

  return response.data;
};

export const closeCall = async (callData: CloseCallRequest) => {
  const data = {
    Id: callData.callId,
    Type: callData.type,
    Notes: callData.note || '',
  };

  const response = await closeCallApi.put<SaveCallResult>(data);

  // Invalidate cache after successful mutation
  try {
    cacheManager.remove('/Calls/GetActiveCalls');
  } catch (error) {
    // Silently handle cache removal errors
    console.warn('Failed to invalidate calls cache:', error);
  }

  return response.data;
};
