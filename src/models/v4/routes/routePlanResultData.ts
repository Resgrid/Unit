export interface RoutePlanResultData {
  RoutePlanId: string;
  DepartmentId?: string;
  UnitId?: number | null;
  Name: string;
  Description?: string | null;
  RouteColor?: string | null;
  RouteStatus?: number;
  MapboxRouteProfile?: string;
  MapboxRouteGeometry?: string;
  EstimatedDistanceMeters?: number | null;
  EstimatedDurationSeconds?: number | null;
  StopsCount?: number;
  ScheduleInfo?: string | null;
  AddedOn?: string;
  Stops?: RouteStopResultData[];
}

export interface RouteStopResultData {
  RouteStopId: string;
  RoutePlanId: string;
  Name: string;
  Address: string;
  Latitude: number;
  Longitude: number;
  StopOrder: number;
  StopType: number;
  Priority: number;
  PlannedArrival: string;
  PlannedDeparture: string;
  DwellTimeMinutes: number;
  GeofenceRadiusMeters: number;
  ContactId: string;
  CallId: string;
  Notes: string;
  CreatedOn: string;
}
