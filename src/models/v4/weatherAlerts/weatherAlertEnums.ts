export enum WeatherAlertSeverity {
  Extreme = 0,
  Severe = 1,
  Moderate = 2,
  Minor = 3,
  Unknown = 4,
}

export enum WeatherAlertCategory {
  Met = 0,
  Fire = 1,
  Health = 2,
  Env = 3,
  Other = 4,
}

export enum WeatherAlertUrgency {
  Immediate = 0,
  Expected = 1,
  Future = 2,
  Past = 3,
  Unknown = 4,
}

export enum WeatherAlertCertainty {
  Observed = 0,
  Likely = 1,
  Possible = 2,
  Unlikely = 3,
  Unknown = 4,
}

export enum WeatherAlertStatus {
  Active = 0,
  Updated = 1,
  Expired = 2,
  Cancelled = 3,
}

export enum WeatherAlertSourceType {
  NWS = 0,
  EnvironmentCanada = 1,
  MeteoAlarm = 2,
}
