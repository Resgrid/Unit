import { BaseV4Request } from '../baseV4Request';
import { type ResourceIncidentView } from './resourceIncidentView';

export class ResourceIncidentViewResult extends BaseV4Request {
  // Data is null when the call has no incident command (Status === 'NotFound').
  public Data: ResourceIncidentView | null = null;
}
