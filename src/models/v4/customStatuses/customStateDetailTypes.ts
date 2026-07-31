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
  return statusDetailAllowsCalls(detail);
};

export const statusDetailAllowsPois = (detail: number): boolean => {
  if (detail === CustomStateDetailTypes.Pois || detail === CustomStateDetailTypes.CallsAndPois || detail === CustomStateDetailTypes.StationsAndPois || detail === CustomStateDetailTypes.CallsStationsAndPois) {
    return true;
  }

  // Some departments still expose destination-capable statuses using the older
  // call/station Detail values even though POIs are valid destinations there.
  return statusDetailAllowsCalls(detail) || statusDetailAllowsStations(detail);
};
