import { Action } from '@ngrx/store';
import {
  CallPriorityResultData,
  CallResultData,
  MapDataAndMarkersData,
  UnitResultData,
  UnitStatusResultData,
  UnitTypeStatusResultData,
  UnitRoleResultData,
} from '@resgrid/ngx-resgridlib';
import { GeoLocation } from 'src/app/models/geoLocation';
import { PushData } from 'src/app/models/pushData';
import { AppPayload } from '../models/appPayload';

export enum HomeActionTypes {
  LOADING_MAP = '[HOME] LOADING MAP',
  LOADING_MAP_SUCCESS = '[HOME] LOADING_MAP_SUCCESS',
  LOADING_MAP_FAIL = '[HOME] LOADING_MAP_FAIL',
  GEOLOCATION_START_TRACKING = '[HOME] GEOLOCATION_START_TRACKING',
  GEOLOCATION_STOP_TRACKING = '[HOME] GEOLOCATION_STOP_TRACKING',
  GEOLOCATION_LOCATION_UPDATE = '[HOME] GEOLOCATION_LOCATION_UPDATE',
  GEOLOCATION_LOCATION_UPDATE_SENT = '[HOME] GEOLOCATION_LOCATION_UPDATE_SENT',
  GEOLOCATION_LOCATION_UPDATE_DONE = '[HOME] GEOLOCATION_LOCATION_UPDATE_DONE',
  LOADING_APP_DATA = '[HOME] LOADING_APP_DATA',
  LOADING_APP_DATA_SUCCESS = '[HOME] LOADING_APP_DATA_SUCCESS',
  LOADING_APP_DATA_FAIL = '[HOME] LOADING_APP_DATA_FAIL',
  LOADING_APP_DATA_DONE = '[HOME] LOADING_APP_DATA_DONE',
  SET_ACTIVEUNIT = '[HOME] SET_ACTIVEUNIT',
  SET_ACTIVEUNIT_DONE = '[HOME] SET_ACTIVEUNIT_DONE',
  SET_ACTIVECALL = '[HOME] SET_ACTIVECALL',
  SET_ACTIVECALL_DONE = '[HOME] SET_ACTIVECALL_DONE',
  GET_CURRENT_STATUS = '[HOME] GET_CURRENT_STATUS',
  GET_CURRENT_STATUS_DONE = '[HOME] GET_CURRENT_STATUS_DONE',
  GET_CURRENT_STATUS_SET = '[HOME] GET_CURRENT_STATUS_SET',
  CLOSE_MODAL = '[HOME] CLOSE_MODAL',
  REFRESH_MAP_DATA = '[HOME] REFRESH_MAP_DATA',
  START_SIGNALR = '[HOME] START_SIGNALR',
  STOP_SIGNALR = '[HOME] STOP_SIGNALR',
  PUSH_CALLRECEIVED = '[HOME] PUSH_CALLRECEIVED',
  PUSH_CALLRECEIVED_SHOWMODAL = '[HOME] PUSH_CALLRECEIVED_SHOWMODAL',
  BACKGROUND_GEOLOCATION_START = '[HOME] BACKGROUND_GEOLOCATION_START',
  BACKGROUND_GEOLOCATION_STOP = '[HOME] BACKGROUND_GEOLOCATION_STOP',

  GET_CURRENT_ROLES = '[HOME] GET_CURRENT_ROLES',
  GET_CURRENT_ROLES_DONE = '[HOME] GET_CURRENT_ROLES_DONE',
  GET_CURRENT_ROLES_SET = '[HOME] GET_CURRENT_ROLES_SET',
}

export class LoadingMap implements Action {
  readonly type = HomeActionTypes.LOADING_MAP;
  constructor() {}
}

export class LoadingMapSuccess implements Action {
  readonly type = HomeActionTypes.LOADING_MAP_SUCCESS;
  constructor(public payload: MapDataAndMarkersData) {}
}

export class LoadingMapFail implements Action {
  readonly type = HomeActionTypes.LOADING_MAP_FAIL;
  constructor(public payload: string) {}
}

export class LoadAppData implements Action {
  readonly type = HomeActionTypes.LOADING_APP_DATA;
  constructor() {}
}

export class LoadAppDataSuccess implements Action {
  readonly type = HomeActionTypes.LOADING_APP_DATA_SUCCESS;
  constructor(public payload: AppPayload) {}
}

export class DoneLoadAppData implements Action {
  readonly type = HomeActionTypes.LOADING_APP_DATA_DONE;
  constructor() {}
}

export class LoadAppDataFail implements Action {
  readonly type = HomeActionTypes.LOADING_APP_DATA_FAIL;
  constructor(public payload: string) {}
}

export class GeolocationStartTracking implements Action {
  readonly type = HomeActionTypes.GEOLOCATION_START_TRACKING;
  constructor() {}
}

export class GeolocationStopTracking implements Action {
  readonly type = HomeActionTypes.GEOLOCATION_STOP_TRACKING;
  constructor() {}
}

export class GeolocationLocationUpdate implements Action {
  readonly type = HomeActionTypes.GEOLOCATION_LOCATION_UPDATE;
  constructor(public payload: GeoLocation) {}
}

export class GeolocationLocationUpdateDone implements Action {
  readonly type = HomeActionTypes.GEOLOCATION_LOCATION_UPDATE_DONE;
  constructor() {}
}

export class GeolocationLocationUpdateSent implements Action {
  readonly type = HomeActionTypes.GEOLOCATION_LOCATION_UPDATE_SENT;
  constructor() {}
}

export class SetActiveUnit implements Action {
  readonly type = HomeActionTypes.SET_ACTIVEUNIT;
  constructor(public unit: UnitResultData, public statuses: UnitTypeStatusResultData) {}
}

export class SetActiveUnitDone implements Action {
  readonly type = HomeActionTypes.SET_ACTIVEUNIT_DONE;
  constructor() {}
}

export class SetActiveCall implements Action {
  readonly type = HomeActionTypes.SET_ACTIVECALL;
  constructor(public call: CallResultData, public priority: CallPriorityResultData) {}
}

export class SetActiveCallDone implements Action {
  readonly type = HomeActionTypes.SET_ACTIVECALL_DONE;
  constructor() {}
}

export class GetCurrentStatus implements Action {
  readonly type = HomeActionTypes.GET_CURRENT_STATUS;
  constructor() {}
}

export class GetCurrentStatusSet implements Action {
  readonly type = HomeActionTypes.GET_CURRENT_STATUS_SET;
  constructor(public status: UnitStatusResultData) {}
}

export class GetCurrentStatusDone implements Action {
  readonly type = HomeActionTypes.GET_CURRENT_STATUS_DONE;
  constructor() {}
}

export class CloseModal implements Action {
  readonly type = HomeActionTypes.CLOSE_MODAL;
  constructor() {}
}

export class RefreshMapData implements Action {
  readonly type = HomeActionTypes.REFRESH_MAP_DATA;
  constructor() {}
}

export class StartSignalR implements Action {
  readonly type = HomeActionTypes.START_SIGNALR;
  constructor() {}
}

export class StopSignalR implements Action {
  readonly type = HomeActionTypes.STOP_SIGNALR;
  constructor() {}
}

export class PushCallReceived implements Action {
  readonly type = HomeActionTypes.PUSH_CALLRECEIVED;
  constructor(public pushData: PushData) {}
}

export class BackgroundGeolocationStart implements Action {
  readonly type = HomeActionTypes.BACKGROUND_GEOLOCATION_START;
  constructor() {}
}

export class BackgroundGeolocationStop implements Action {
  readonly type = HomeActionTypes.BACKGROUND_GEOLOCATION_STOP;
  constructor() {}
}

export class GetCurrentRoles implements Action {
  readonly type = HomeActionTypes.GET_CURRENT_ROLES;
  constructor() {}
}

export class GetCurrentRolesSet implements Action {
  readonly type = HomeActionTypes.GET_CURRENT_ROLES_SET;
  constructor(public roles: UnitRoleResultData[]) {}
}

export class GetCurrentRolesDone implements Action {
  readonly type = HomeActionTypes.GET_CURRENT_ROLES_DONE;
  constructor() {}
}

export type HomeActionsUnion =
  | LoadingMap
  | LoadingMapSuccess
  | LoadingMapFail
  | GeolocationStartTracking
  | GeolocationStopTracking
  | GeolocationLocationUpdate
  | LoadAppDataSuccess
  | LoadAppDataFail
  | LoadAppData
  | SetActiveUnit
  | SetActiveUnitDone
  | SetActiveCall
  | SetActiveCallDone
  | GetCurrentStatus
  | GetCurrentStatusDone
  | GetCurrentStatusSet
  | CloseModal
  | GeolocationLocationUpdateDone
  | GeolocationLocationUpdateSent
  | RefreshMapData
  | StartSignalR
  | StopSignalR
  | PushCallReceived
  | BackgroundGeolocationStart
  | BackgroundGeolocationStop
  | GetCurrentRoles
  | GetCurrentRolesSet
  | GetCurrentRolesDone;
