import { BaseV4Request } from '../baseV4Request';
import { type DirectionsResultData } from './directionsResultData';
import { type RouteDeviationResultData } from './routeDeviationResultData';
import { type ActiveRouteForUnitData, type RouteInstanceResultData } from './routeInstanceResultData';
import { type RouteInstanceStopResultData } from './routeInstanceStopResultData';
import { type RoutePlanResultData } from './routePlanResultData';

export class GetRoutePlansResult extends BaseV4Request {
  public Data: RoutePlanResultData[] = [];
}

export class GetRoutePlanResult extends BaseV4Request {
  public Data: RoutePlanResultData = {} as RoutePlanResultData;
}

export class GetRouteInstanceResult extends BaseV4Request {
  public Data: RouteInstanceResultData = {} as RouteInstanceResultData;
}

export class GetActiveRouteForUnitResult extends BaseV4Request {
  public Data: ActiveRouteForUnitData | null = null;
}

export class GetRouteInstancesResult extends BaseV4Request {
  public Data: RouteInstanceResultData[] = [];
}

export class GetRouteProgressResult extends BaseV4Request {
  public Data: RouteInstanceResultData = {} as RouteInstanceResultData;
}

export class GetRouteInstanceStopsResult extends BaseV4Request {
  public Data: RouteInstanceStopResultData[] = [];
}

export class GetDirectionsResult extends BaseV4Request {
  public Data: DirectionsResultData = {} as DirectionsResultData;
}

export class GetRouteDeviationsResult extends BaseV4Request {
  public Data: RouteDeviationResultData[] = [];
}

export class SaveRoutePlanResult extends BaseV4Request {
  public Data: RouteInstanceResultData = {} as RouteInstanceResultData;
}

export class GetActiveRouteInstancesResult extends BaseV4Request {
  public Data: RouteInstanceResultData[] = [];
}

export class GetScheduledRoutesResult extends BaseV4Request {
  public Data: RouteInstanceResultData[] = [];
}
