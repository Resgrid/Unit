import { Action } from '@ngrx/store';
import {
  CallResultData,
  GroupResultData,
  StatusesResultData,
} from '@resgrid/ngx-resgridlib';
import { StatusDestination } from '../models/statusDestination';

export enum StatusesActionTypes {
  SUBMIT_UNIT_STATUS_START = '[STATUSES] SUBMIT_UNIT_STATUS_START',
  SUBMIT_UNIT_STATUS_SET = '[STATUSES] SUBMIT_UNIT_STATUS_SET',
  SUBMIT_UNIT_STATUS_NOTE = '[STATUSES] SUBMIT_UNIT_STATUS_NOTE',
  SUBMIT_UNIT_STATUS_DESTINATION = '[STATUSES] SUBMIT_UNIT_STATUS_DESTINATION',
  SUBMIT_UNIT_STATUS_DESTINATION_MODAL = '[STATUSES] SUBMIT_UNIT_STATUS_DESTINATION_MODAL',
  SUBMIT_UNIT_STATUS_DESTINATION_SET = '[STATUSES] SUBMIT_UNIT_STATUS_DESTINATION_SET',
  SUBMIT_UNIT_STATUS_NOTE_SET = '[STATUSES] SUBMIT_UNIT_STATUS_NOTE_SET',
  SUBMIT_UNIT_STATUS_NOTE_MODAL = '[STATUSES] SUBMIT_UNIT_STATUS_NOTE_MODAL',
  SUBMIT_UNIT_STATUS_SET_DONE = '[STATUSES] SUBMIT_UNIT_STATUS_SET_DONE',
  SUBMIT_UNIT_STATUS_SET_ERROR = '[STATUSES] SUBMIT_UNIT_STATUS_SET_ERROR',
  SUBMIT_UNIT_STATUS_SET_FINISH = '[STATUSES] SUBMIT_UNIT_STATUS_SET_FINISH',
}

export class SubmitUnitStatus implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_START;
  constructor(public status: StatusesResultData, public groups: GroupResultData[], public calls: CallResultData[]) {}
}

export class SubmitUnitStatusSet implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_SET;
  constructor() {}
}

export class SubmitUnitStatusNote implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE;
  constructor(public status: StatusesResultData) {}
}

export class SubmitUnitStatusNoteModal implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE_MODAL;
  constructor(public status: StatusesResultData) {}
}

export class SubmitUnitStatusDesination implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_DESTINATION;
  constructor(public status: StatusesResultData, public destinations: StatusDestination[]) {}
}

export class SubmitUnitStatusDesinationModal implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_DESTINATION_MODAL;
  constructor() {}
}

export class SubmitUnitStatusDesinationSet implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_DESTINATION_SET;
  constructor(public status: StatusesResultData, public destination: StatusDestination) {}
}

export class SubmitUnitStatusNoteSet implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE_SET;
  constructor(public note: string) {}
}

export class SubmitUnitStatusSetDone implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_SET_DONE;
  constructor() {}
}

export class SubmitUnitStatusSetError implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_SET_ERROR;
  constructor(public payload: string) {}
}

export class SubmitUnitStatusSetFinish implements Action {
  readonly type = StatusesActionTypes.SUBMIT_UNIT_STATUS_SET_FINISH;
  constructor() {}
}

export type StatusesActionsUnion =
  | SubmitUnitStatus
  | SubmitUnitStatusSet
  | SubmitUnitStatusNote
  | SubmitUnitStatusDesination
  | SubmitUnitStatusDesinationModal
  | SubmitUnitStatusDesinationSet
  | SubmitUnitStatusNoteSet
  | SubmitUnitStatusNoteModal
  | SubmitUnitStatusSetDone
  | SubmitUnitStatusSetError
  | SubmitUnitStatusSetFinish;
