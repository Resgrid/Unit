import { cacheManager } from '@/lib/cache/cache-manager';
import { type ContactResult } from '@/models/v4/contacts/contactResult';
import { type ContactsResult } from '@/models/v4/contacts/contactsResult';
import {
  type CancelRouteInput,
  type CheckInInput,
  type CheckOutInput,
  type EndRouteInput,
  type GeofenceCheckInInput,
  type PauseRouteInput,
  type ResumeRouteInput,
  type SkipStopInput,
  type StartRouteInput,
  type UpdateStopNotesInput,
} from '@/models/v4/routes/routeInputs';
import {
  type GetActiveRouteForUnitResult,
  type GetActiveRouteInstancesResult,
  type GetDirectionsResult,
  type GetRouteDeviationsResult,
  type GetRouteInstanceResult,
  type GetRouteInstanceStopsResult,
  type GetRouteInstancesResult,
  type GetRoutePlanResult,
  type GetRoutePlansResult,
  type GetRouteProgressResult,
  type GetScheduledRoutesResult,
  type SaveRoutePlanResult,
} from '@/models/v4/routes/routeResults';

import { createCachedApiEndpoint } from '../common/cached-client';
import { api, createApiEndpoint } from '../common/client';

// Route plan endpoints
const getRoutePlansApi = createCachedApiEndpoint('/Routes/GetRoutePlans', {
  ttl: 60 * 1000,
  enabled: true,
});

// Route lifecycle endpoints (no path params)
const startRouteApi = createApiEndpoint('/Routes/StartRoute');
const endRouteApi = createApiEndpoint('/Routes/EndRoute');
const pauseRouteApi = createApiEndpoint('/Routes/PauseRoute');
const resumeRouteApi = createApiEndpoint('/Routes/ResumeRoute');
const cancelRouteApi = createApiEndpoint('/Routes/CancelRoute');

// Instance tracking endpoints (no path params)
const getActiveRoutesApi = createApiEndpoint('/Routes/GetActiveRoutes');

// Stop interaction endpoints (no path params)
const checkInAtStopApi = createApiEndpoint('/Routes/CheckInAtStop');
const checkOutFromStopApi = createApiEndpoint('/Routes/CheckOutFromStop');
const skipStopApi = createApiEndpoint('/Routes/SkipStop');
const geofenceCheckInApi = createApiEndpoint('/Routes/GeofenceCheckIn');
const updateStopNotesApi = createApiEndpoint('/Routes/UpdateStopNotes');

// Deviation endpoints (no path params)
const getUnacknowledgedDeviationsApi = createApiEndpoint('/Routes/GetUnacknowledgedDeviations');

// Fleet monitoring endpoints (no path params)
const getActiveRouteInstancesApi = createApiEndpoint('/Routes/GetActiveRouteInstances');
const getScheduledRoutesApi = createApiEndpoint('/Routes/GetScheduledRoutes');

// --- Route Plans ---

export const getRoutePlans = async () => {
  const response = await getRoutePlansApi.get<GetRoutePlansResult>();
  return response.data;
};

export const getRoutePlansForUnit = async (unitId: string) => {
  const response = await api.get<GetRoutePlansResult>(`/Routes/GetRoutePlansForUnit/${encodeURIComponent(unitId)}`);
  return response.data;
};

export const getRoutePlan = async (routePlanId: string) => {
  const response = await api.get<GetRoutePlanResult>(`/Routes/GetRoutePlan/${encodeURIComponent(routePlanId)}`);
  return response.data;
};

// --- Route Lifecycle ---

export const startRoute = async (input: StartRouteInput) => {
  const response = await startRouteApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  cacheManager.remove('/Routes/GetRoutePlans');
  return response.data;
};

export const endRoute = async (input: EndRouteInput) => {
  const response = await endRouteApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  cacheManager.remove('/Routes/GetRoutePlans');
  return response.data;
};

export const pauseRoute = async (input: PauseRouteInput) => {
  const response = await pauseRouteApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  return response.data;
};

export const resumeRoute = async (input: ResumeRouteInput) => {
  const response = await resumeRouteApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  return response.data;
};

export const cancelRoute = async (input: CancelRouteInput) => {
  const response = await cancelRouteApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  cacheManager.remove('/Routes/GetRoutePlans');
  return response.data;
};

// --- Instance Tracking ---

export const getActiveRouteForUnit = async (unitId: string) => {
  const response = await api.get<GetActiveRouteForUnitResult>(`/Routes/GetActiveRouteForUnit/${encodeURIComponent(unitId)}`);
  return response.data;
};

export const getActiveRoutes = async () => {
  const response = await getActiveRoutesApi.get<GetActiveRouteInstancesResult>();
  return response.data;
};

export const getRouteProgress = async (instanceId: string) => {
  const response = await api.get<GetRouteProgressResult>(`/Routes/GetRouteProgress/${encodeURIComponent(instanceId)}`);
  return response.data;
};

export const getStopsForInstance = async (instanceId: string) => {
  const response = await api.get<GetRouteInstanceStopsResult>(`/Routes/GetStopsForInstance/${encodeURIComponent(instanceId)}`);
  return response.data;
};

export const getInstanceDirections = async (instanceId: string) => {
  const response = await api.get<GetDirectionsResult>(`/Routes/GetInstanceDirections/${encodeURIComponent(instanceId)}`);
  return response.data;
};

export const getDirections = async (routePlanId: string) => {
  const response = await api.get<GetDirectionsResult>(`/Routes/GetDirections/${encodeURIComponent(routePlanId)}`);
  return response.data;
};

// --- Stop Interactions ---

export const checkInAtStop = async (input: CheckInInput) => {
  const response = await checkInAtStopApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  return response.data;
};

export const checkOutFromStop = async (input: CheckOutInput) => {
  const response = await checkOutFromStopApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  return response.data;
};

export const skipStop = async (input: SkipStopInput) => {
  const response = await skipStopApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  return response.data;
};

export const geofenceCheckIn = async (input: GeofenceCheckInInput) => {
  const response = await geofenceCheckInApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  return response.data;
};

export const updateStopNotes = async (input: UpdateStopNotesInput) => {
  const response = await updateStopNotesApi.post<SaveRoutePlanResult>(input as unknown as Record<string, unknown>);
  return response.data;
};

// --- Contacts ---

export const getStopContact = async (routeStopId: string) => {
  const response = await api.get<ContactResult>(`/Routes/GetStopContact/${encodeURIComponent(routeStopId)}`);
  return response.data;
};

export const getRouteContacts = async (routePlanId: string) => {
  const response = await api.get<ContactsResult>(`/Routes/GetRouteContacts/${encodeURIComponent(routePlanId)}`);
  return response.data;
};

// --- Deviations ---

export const getUnacknowledgedDeviations = async () => {
  const response = await getUnacknowledgedDeviationsApi.get<GetRouteDeviationsResult>();
  return response.data;
};

export const acknowledgeDeviation = async (deviationId: string) => {
  const response = await api.post<SaveRoutePlanResult>(`/Routes/AcknowledgeDeviation/${encodeURIComponent(deviationId)}`, {});
  return response.data;
};

// --- History ---

export const getRouteHistory = async (routePlanId: string) => {
  const response = await api.get<GetRouteInstancesResult>(`/Routes/GetRouteHistory/${encodeURIComponent(routePlanId)}`);
  return response.data;
};

// --- Fleet Monitoring ---

export const getActiveRouteInstances = async () => {
  const response = await getActiveRouteInstancesApi.get<GetActiveRouteInstancesResult>();
  return response.data;
};

export const getScheduledRoutes = async () => {
  const response = await getScheduledRoutesApi.get<GetScheduledRoutesResult>();
  return response.data;
};
