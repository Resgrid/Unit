export interface DirectionsResultData {
  RoutePlanId: string;
  RouteInstanceId?: string;
  EstimatedDistanceMeters?: number | null;
  EstimatedDurationSeconds?: number | null;
  Geometry?: string | null;
  Waypoints?: DirectionsWaypointData[];
}

export interface DirectionsWaypointData {
  RouteStopId: string;
  Name?: string | null;
  Address?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
  StopOrder?: number;
}
