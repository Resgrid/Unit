import type { RouteInstanceStopResultData } from './routeInstanceStopResultData';

export interface RouteInstanceResultData {
  RouteInstanceId: string;
  RoutePlanId: string;
  RoutePlanName?: string | null;
  Status: number;
  UnitId?: number | null;
  StopsCompleted?: number;
  StopsTotal?: number;
  TotalDistanceMeters?: number | null;
  TotalDurationSeconds?: number | null;
  ActualStartOn?: string | null;
  ActualEndOn?: string | null;
  StartedOn?: string | null;
  CompletedOn?: string | null;
  CancelledOn?: string | null;
  AddedOn?: string;
  Notes?: string | null;
  // Fields that may come from progress/other endpoints
  ActualRouteGeometry?: string | null;
  CurrentStopIndex?: number;
  ProgressPercentage?: number | null;
  EtaToNextStop?: string | null;
  RouteColor?: string | null;
  UnitName?: string | null;
}

export interface ActiveRouteForUnitData {
  Instance: RouteInstanceResultData;
  TotalStops: number;
  CompletedStops: number;
  PendingStops: number;
  SkippedStops: number;
  Stops: RouteInstanceStopResultData[];
}

export enum RouteInstanceStatus {
  Pending = 0,
  Active = 1,
  Paused = 2,
  Completed = 3,
  Cancelled = 4,
}
