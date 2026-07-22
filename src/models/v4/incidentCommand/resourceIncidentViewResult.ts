import { BaseV4Request } from '../baseV4Request';
import { type ResourceIncidentView } from './resourceIncidentView';

// Envelope Status value the server sends when the call has no incident command.
export const INCIDENT_VIEW_STATUS_NOT_FOUND = 'NotFound';

export class ResourceIncidentViewResult extends BaseV4Request {
  // Data is null when the call has no incident command (Status === 'NotFound').
  public Data: ResourceIncidentView | null = null;
}
