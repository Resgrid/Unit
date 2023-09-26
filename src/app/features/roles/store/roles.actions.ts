import { Action } from '@ngrx/store';
import { CallProtocolsResultData, MapDataAndMarkersData, NoteCategoryResultData, NoteResultData } from '@resgrid/ngx-resgridlib';

export enum RolesActionTypes {
  DISMISS_MODAL = '[ROLES] DISMISS_MODAL',
}


export class DismissModal implements Action {
  readonly type = RolesActionTypes.DISMISS_MODAL;
  constructor() {}
}

export type RolesActionsUnion =
  | DismissModal
  ;
