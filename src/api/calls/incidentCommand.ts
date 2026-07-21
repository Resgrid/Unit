import { type ResourceIncidentViewResult } from '@/models/v4/incidentCommand/resourceIncidentViewResult';

import { createApiEndpoint } from '../common/client';

/**
 * Fetches the resource-facing incident command view for a call.
 *
 * The route is RPC-style with the call id embedded in the path. The unit id is
 * passed as a query parameter so the server can resolve the unit's lane
 * assignment (MyAssignment). When no unit id is available the endpoint is
 * called without it and the server resolves no assignment.
 */
export const getResourceIncidentView = async (callId: string | number, unitId?: string | number | null) => {
  const getResourceIncidentViewApi = createApiEndpoint(`/IncidentCommand/GetResourceIncidentView/${encodeURIComponent(String(callId))}`);
  const params = unitId !== undefined && unitId !== null && unitId !== '' ? { unitId } : undefined;
  const response = await getResourceIncidentViewApi.get<ResourceIncidentViewResult>(params);
  return response.data;
};
