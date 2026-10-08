import { cacheManager } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logging';
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
const updateCallApi = createApiEndpoint('/Calls/EditCall');
const closeCallApi = createApiEndpoint('/Calls/CloseCall');

export const getCalls = async (forceRefresh = false) => {
  const response = await callsApi.get<ActiveCallsResult>(undefined, { forceRefresh });
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
  destinationPoiId?: number | null;
  latitude?: number;
  longitude?: number;
  priority: number;
  type?: string;
  contactName?: string;
  contactInfo?: string;
  /** External (CAD) call id. On update, blank keeps the stored value. */
  externalId?: string;
  incidentId?: string;
  referenceId?: string;
  /**
   * Scheduled dispatch time as an ISO 8601 UTC instant. Sent only when set: on create a past time dispatches at once
   * (ignored for a pending call); on update, leaving it out keeps the schedule — the API has no way to clear it.
   */
  dispatchOnUtc?: string;
  /** Primary Contact (premises/customer record) to link; the contact must belong to the department. */
  contactId?: string | null;
  /** Additional Contacts to link. On update, supplying either list replaces the existing links; omitting both leaves them alone. */
  additionalContactIds?: string[];
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
  destinationPoiId?: number | null;
  latitude?: number;
  longitude?: number;
  priority: number;
  type?: string;
  contactName?: string;
  contactInfo?: string;
  /** External (CAD) call id. On update, blank keeps the stored value. */
  externalId?: string;
  incidentId?: string;
  referenceId?: string;
  /**
   * Scheduled dispatch time as an ISO 8601 UTC instant. Sent only when set: on create a past time dispatches at once
   * (ignored for a pending call); on update, leaving it out keeps the schedule — the API has no way to clear it.
   */
  dispatchOnUtc?: string;
  /** Primary Contact (premises/customer record) to link; the contact must belong to the department. */
  contactId?: string | null;
  /** Additional Contacts to link. On update, supplying either list replaces the existing links; omitting both leaves them alone. */
  additionalContactIds?: string[];
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
  /**
   * Alert everyone attached to the call (dispatched personnel, groups, roles, units and the incident
   * command team) that it is closed. Omitted from the request when not set, leaving the server default.
   */
  sendNotification?: boolean;
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
    dispatchEntries.push(...data.dispatchUsers.map((user) => `P:${user}`));
  }
  if (data.dispatchGroups) {
    dispatchEntries.push(...data.dispatchGroups.map((group) => `G:${group}`));
  }
  if (data.dispatchRoles) {
    dispatchEntries.push(...data.dispatchRoles.map((role) => `R:${role}`));
  }
  if (data.dispatchUnits) {
    dispatchEntries.push(...data.dispatchUnits.map((unit) => `U:${unit}`));
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
    DestinationPoiId: callData.destinationPoiId ?? null,
    Geolocation: `${callData.latitude?.toString() || ''},${callData.longitude?.toString() || ''}`,
    Priority: callData.priority,
    Type: callData.type || '',
    ContactName: callData.contactName || '',
    ContactInfo: callData.contactInfo || '',
    ExternalId: callData.externalId || '',
    IncidentId: callData.incidentId || '',
    ReferenceId: callData.referenceId || '',
    ...(callData.dispatchOnUtc ? { DispatchOnUtc: callData.dispatchOnUtc } : {}),
    ...(callData.contactId !== undefined ? { ContactId: callData.contactId || '' } : {}),
    ...(callData.additionalContactIds !== undefined ? { AdditionalContactIds: callData.additionalContactIds } : {}),
    What3Words: callData.what3words || '',
    PlusCode: callData.plusCode || '',
    DispatchList: dispatchList,
  };

  const response = await createCallApi.post<SaveCallResult>(data);

  // Invalidate cache after successful mutation
  try {
    cacheManager.remove('/Calls/GetActiveCalls');
  } catch (error) {
    // Cache removal failures are non-fatal
    logger.warn({ message: 'Failed to invalidate calls cache', context: { error } });
  }

  return response.data;
};

export const updateCall = async (callData: UpdateCallRequest) => {
  const dispatchList = buildDispatchList(callData);

  const data = {
    Id: callData.callId,
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    DestinationPoiId: callData.destinationPoiId ?? null,
    Geolocation: `${callData.latitude?.toString() || ''},${callData.longitude?.toString() || ''}`,
    Priority: callData.priority,
    Type: callData.type || '',
    ContactName: callData.contactName || '',
    ContactInfo: callData.contactInfo || '',
    ExternalId: callData.externalId || '',
    IncidentId: callData.incidentId || '',
    ReferenceId: callData.referenceId || '',
    ...(callData.dispatchOnUtc ? { DispatchOnUtc: callData.dispatchOnUtc } : {}),
    ...(callData.contactId !== undefined ? { ContactId: callData.contactId || '' } : {}),
    ...(callData.additionalContactIds !== undefined ? { AdditionalContactIds: callData.additionalContactIds } : {}),
    What3Words: callData.what3words || '',
    PlusCode: callData.plusCode || '',
    DispatchList: dispatchList,
  };

  const response = await updateCallApi.put<SaveCallResult>(data);

  // Invalidate cache after successful mutation
  try {
    cacheManager.remove('/Calls/GetActiveCalls');
  } catch (error) {
    // Cache removal failures are non-fatal
    logger.warn({ message: 'Failed to invalidate calls cache', context: { error } });
  }

  return response.data;
};

export const closeCall = async (callData: CloseCallRequest) => {
  const data = {
    Id: callData.callId,
    Type: callData.type,
    Notes: callData.note || '',
    ...(callData.sendNotification !== undefined ? { SendNotification: callData.sendNotification } : {}),
  };

  const response = await closeCallApi.put<SaveCallResult>(data);

  // Invalidate cache after successful mutation
  try {
    cacheManager.remove('/Calls/GetActiveCalls');
  } catch (error) {
    // Cache removal failures are non-fatal
    logger.warn({ message: 'Failed to invalidate calls cache', context: { error } });
  }

  return response.data;
};
