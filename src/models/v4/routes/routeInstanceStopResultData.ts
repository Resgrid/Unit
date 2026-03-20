export interface RouteInstanceStopResultData {
  RouteInstanceStopId: string;
  RouteInstanceId: string;
  RouteStopId: string;
  Status: number;
  CheckedInOn: string;
  CheckedOutOn: string;
  SkippedOn: string;
  Notes: string;
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
}

export enum RouteStopStatus {
  Pending = 0,
  InProgress = 1,
  Completed = 2,
  Skipped = 3,
}
