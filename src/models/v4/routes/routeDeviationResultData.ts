export interface RouteDeviationResultData {
  RouteDeviationId: string;
  RouteInstanceId: string;
  Type: number;
  Description: string;
  Latitude: number;
  Longitude: number;
  OccurredOn: string;
  AcknowledgedOn: string;
  AcknowledgedByUserId: string;
  IsAcknowledged: boolean;
}

export enum RouteDeviationType {
  OffRoute = 0,
  MissedStop = 1,
  UnexpectedStop = 2,
  SpeedViolation = 3,
  Other = 4,
}
