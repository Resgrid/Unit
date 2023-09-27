import { Action } from '@ngrx/store';
import { ActiveUnitRoleResultData, CallProtocolsResultData, MapDataAndMarkersData, NoteCategoryResultData, NoteResultData, PersonnelInfoResultData, UnitRoleResultData } from '@resgrid/ngx-resgridlib';

export enum RolesActionTypes {
  GET_SET_ROLE_DATA = '[ROLES] GET_SET_ROLE_DATA',
  GET_SET_ROLE_DATA_SUCCESS = '[ROLES] GET_SET_ROLE_DATA_SUCCESS',
  GET_SET_ROLE_DATA_FAIL = '[ROLES] GET_SET_ROLE_DATA_FAIL',
  SHOW_SET_ROLE_MODAL = '[ROLES] SHOW_SET_ROLE_MODAL',
  DISMISS_MODAL = '[ROLES] DISMISS_MODAL',
}

export class DismissModal implements Action {
  readonly type = RolesActionTypes.DISMISS_MODAL;
  constructor() {}
}

export class GetSetRoleData implements Action {
  readonly type = RolesActionTypes.GET_SET_ROLE_DATA;
  constructor(public unitId: string) {}
}

export class GetSetRoleDataSuccess implements Action {
  readonly type = RolesActionTypes.GET_SET_ROLE_DATA_SUCCESS;
  constructor(public roles: UnitRoleResultData[], 
              public unitRoleAssignments: ActiveUnitRoleResultData[], 
              public users: PersonnelInfoResultData[]) {}
}

export class GetSetRoleDataFail implements Action {
  readonly type = RolesActionTypes.GET_SET_ROLE_DATA_FAIL;
  constructor() {}
}

export class ShowSetRoleDataModal implements Action {
  readonly type = RolesActionTypes.SHOW_SET_ROLE_MODAL;
  constructor() {}
}

export type RolesActionsUnion =
  | DismissModal
  | GetSetRoleData
  | GetSetRoleDataSuccess
  | GetSetRoleDataFail
  | ShowSetRoleDataModal
  ;
