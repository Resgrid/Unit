export enum CustomStateDetailTypes {
  None = 0,
  Stations = 1,
  Calls = 2,
  CallsAndStations = 3,
  Pois = 4,
  CallsAndPois = 5,
  StationsAndPois = 6,
  CallsStationsAndPois = 7,
}

export const statusDetailAllowsCalls = (detail: number): boolean => {
  return detail === CustomStateDetailTypes.Calls || detail === CustomStateDetailTypes.CallsAndStations || detail === CustomStateDetailTypes.CallsAndPois || detail === CustomStateDetailTypes.CallsStationsAndPois;
};

export const statusDetailAllowsStations = (detail: number): boolean => {
  if (detail === CustomStateDetailTypes.Stations || detail === CustomStateDetailTypes.CallsAndStations || detail === CustomStateDetailTypes.StationsAndPois || detail === CustomStateDetailTypes.CallsStationsAndPois) {
    return true;
  }

  // Some departments still expose destination-capable statuses using the older
  // call-only Detail value even though stations are valid destinations there.
  // Verified safe against the backend: SaveUnitStatus (UnitStatusController)
  // validates the destination via IsValidDestinationAsync (entity exists in the
  // same department) and never checks the status Detail flag, and
  // GetSetUnitStatusData (DispatchController) serves these stations/pois as the
  // department's valid destination universe regardless of Detail.
  return statusDetailAllowsCalls(detail);
};

export const statusDetailAllowsPois = (detail: number): boolean => {
  if (detail === CustomStateDetailTypes.Pois || detail === CustomStateDetailTypes.CallsAndPois || detail === CustomStateDetailTypes.StationsAndPois || detail === CustomStateDetailTypes.CallsStationsAndPois) {
    return true;
  }

  // Some departments still expose destination-capable statuses using the older
  // call/station Detail values even though POIs are valid destinations there.
  // Backend-verified: only destination-type POIs are offered/saveable
  // (IsValidDestinationAsync -> GetDestinationPOIByIdAsync), independent of Detail.
  return statusDetailAllowsCalls(detail) || statusDetailAllowsStations(detail);
};
