export interface StartRouteInput {
  RoutePlanId: string;
  UnitId: string;
}

export interface EndRouteInput {
  RouteInstanceId: string;
}

export interface PauseRouteInput {
  RouteInstanceId: string;
}

export interface ResumeRouteInput {
  RouteInstanceId: string;
}

export interface CancelRouteInput {
  RouteInstanceId: string;
}

export interface CheckInInput {
  RouteInstanceStopId: string;
  UnitId: string;
  Latitude: number;
  Longitude: number;
}

export interface CheckOutInput {
  RouteInstanceStopId: string;
  UnitId: string;
}

export interface SkipStopInput {
  RouteInstanceStopId: string;
  Reason: string;
}

export interface GeofenceCheckInInput {
  UnitId: string;
  Latitude: number;
  Longitude: number;
}

export interface UpdateStopNotesInput {
  RouteInstanceStopId: string;
  Notes: string;
}
