import { Action } from '@ngrx/store';
import { ActiveUnitRoleResultData, PersonnelInfoResultData, SetUnitRolesInput, UnitRoleResultData } from '@resgrid/ngx-resgridlib';

export enum RolesActionTypes {
  GET_SET_ROLE_DATA = '[ROLES] GET_SET_ROLE_DATA',
  GET_SET_ROLE_DATA_SUCCESS = '[ROLES] GET_SET_ROLE_DATA_SUCCESS',
  GET_SET_ROLE_DATA_FAIL = '[ROLES] GET_SET_ROLE_DATA_FAIL',
  SHOW_SET_ROLE_MODAL = '[ROLES] SHOW_SET_ROLE_MODAL',
  SAVE_ROLE_DATA = '[ROLES] SAVE_ROLE_DATA',
  SAVE_ROLE_DATA_SUCCESS = '[ROLES] SAVE_ROLE_DATA_SUCCESS',
  SAVE_ROLE_DATA_FAIL = '[ROLES] SAVE_ROLE_DATA_FAIL',
  UPDATE_SET_ROLE_DATA = '[ROLES] UPDATE_SET_ROLE_DATA',
  UPDATE_SET_ROLE_DATA_SUCCESS = '[ROLES] UPDATE_SET_ROLE_DATA_SUCCESS',
  UPDATE_SET_ROLE_DATA_FAIL = '[ROLES] UPDATE_SET_ROLE_DATA_FAIL',
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

export class SaveRoleData implements Action {
  readonly type = RolesActionTypes.SAVE_ROLE_DATA;
  constructor(public assignments: SetUnitRolesInput) {}
}

export class SaveRoleDataSuccess implements Action {
  readonly type = RolesActionTypes.SAVE_ROLE_DATA_SUCCESS;
  constructor(public unitId: string) {}
}

export class SaveRoleDataFail implements Action {
  readonly type = RolesActionTypes.SAVE_ROLE_DATA_FAIL;
  constructor() {}
}

export class UpdateSetRoleData implements Action {
  readonly type = RolesActionTypes.UPDATE_SET_ROLE_DATA;
  constructor() {}
}

export class UpdateSetRoleDataSuccess implements Action {
  readonly type = RolesActionTypes.UPDATE_SET_ROLE_DATA_SUCCESS;
  constructor(public roles: UnitRoleResultData[], 
              public unitRoleAssignments: ActiveUnitRoleResultData[], 
              public users: PersonnelInfoResultData[]) {}
}

export class UpdateSetRoleDataFail implements Action {
  readonly type = RolesActionTypes.UPDATE_SET_ROLE_DATA_FAIL;
  constructor() {}
}

export type RolesActionsUnion =
  | DismissModal
  | GetSetRoleData
  | GetSetRoleDataSuccess
  | GetSetRoleDataFail
  | ShowSetRoleDataModal
  | SaveRoleData
  | SaveRoleDataSuccess
  | SaveRoleDataFail
  | UpdateSetRoleData
  | UpdateSetRoleDataSuccess
  | UpdateSetRoleDataFail
  ;
