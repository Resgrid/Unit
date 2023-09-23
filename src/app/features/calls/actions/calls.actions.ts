import { Action } from '@ngrx/store';
import {
  CallExtraDataResultData,
  CallFileResultData,
  CallNoteResultData,
  CallPriorityResultData,
  CallResultData
} from '@resgrid/ngx-resgridlib';

export enum CallsActionTypes {
  GET_CALLS = '[CALLS] GET_CALLS',
  GET_CALLS_DONE = '[CALLS] GET_CALLS_DONE',
  GET_CALLS_FAIL = '[CALLS] GET_CALLS_FAIL',
  GET_CALL_BYID = '[CALLS] GET_CALL_BYID',
  GET_CALL_BYID_SUCCESS = "[CALLS] GET_CALL_BYID_SUCCESS",
  GET_CALL_BYID_FAIL = "[CALLS] GET_CALL_BYID_FAIL",
  GET_CALL_BYID_DONE = "[CALLS] GET_CALL_BYID_DONE",
  SHOW_CALLNOTES = '[CALLS] SHOW_CALLNOTES',
  OPEN_CALLNOTES = '[CALLS] OPEN_CALLNOTES',
  SAVE_CALLNOTE = '[CALLS] SAVE_CALLNOTE',
  SAVE_CALLNOTE_SUCCESS = '[CALLS] SAVE_CALLNOTE_SUCCESS',
  SAVE_CALLNOTE_FAIL = '[CALLS] SAVE_CALLNOTE_FAIL',
  SET_VIEW_CALL_MODAL = '[CALLS] SET_VIEW_CALL_MODAL',
  DONE = '[CALLS] DONE',
  SHOW_CALLIMAGES = '[CALLS] SHOW_CALLIMAGES',
  OPEN_CALLIMAGES = '[CALLS] OPEN_CALLIMAGES',
  UPLOAD_CALLIMAGE = '[CALLS] UPLOAD_CALLIMAGE',
  UPLOAD_CALLIMAGE_SUCCESS = '[CALLS] UPLOAD_CALLIMAGE_SUCCESS',
  UPLOAD_CALLIMAGE_FAIL = '[CALLS] UPLOAD_CALLIMAGE_FAIL',
  SHOW_CALLFILESMODAL = '[CALLS] SHOW_CALLFILESMODAL',
  OPEN_CALLFILESMODAL = '[CALLS] OPEN_CALLFILESMODAL',
  UPLOAD_CALLFILE = '[CALLS] UPLOAD_CALLFILE',
  UPLOAD_CALLFILE_SUCCESS = '[CALLS] UPLOAD_CALLFILE_SUCCESS',
  UPLOAD_CALLFILE_FAIL = '[CALLS] UPLOAD_CALLFILE_FAIL',
}

export class GetCalls implements Action {
  readonly type = CallsActionTypes.GET_CALLS;
  constructor() {}
}

export class GetCallsDone implements Action {
  readonly type = CallsActionTypes.GET_CALLS_DONE;
  constructor(public calls: CallResultData[], public priorities: CallPriorityResultData[]) {}
}

export class GetCallFail implements Action {
  readonly type = CallsActionTypes.GET_CALLS_FAIL;
  constructor() {}
}

export class GetCallById implements Action {
  readonly type = CallsActionTypes.GET_CALL_BYID;
  constructor(public callId: string) {}
}

export class GetCallByIdSuccess implements Action {
  readonly type = CallsActionTypes.GET_CALL_BYID_SUCCESS;
  constructor(public call: CallResultData, public data: CallExtraDataResultData, public priorities: CallPriorityResultData[]) {}
}


export class GetCallByIdFailure implements Action {
  readonly type = CallsActionTypes.GET_CALL_BYID_FAIL;
  constructor(public payload: string) {}
}

export class GetCallByIdDone implements Action {
  readonly type = CallsActionTypes.GET_CALL_BYID_DONE;
  constructor() {}
}

export class ShowCallNotesModal implements Action {
  readonly type = CallsActionTypes.SHOW_CALLNOTES;
  constructor(public callId: string) {}
}

export class OpenCallNotesModal implements Action {
  readonly type = CallsActionTypes.OPEN_CALLNOTES;
  constructor(public payload: CallNoteResultData[]) {}
}

export class SaveCallNote implements Action {
  readonly type = CallsActionTypes.SAVE_CALLNOTE;
  constructor(public callId: string, public callNote: string, public userId: string) {}
}

export class SaveCallNoteSuccess implements Action {
  readonly type = CallsActionTypes.SAVE_CALLNOTE_SUCCESS;
  constructor() {}
}

export class SaveCallNoteFail implements Action {
  readonly type = CallsActionTypes.SAVE_CALLNOTE_FAIL;
  constructor() {}
}

export class SetViewCallModal implements Action {
  readonly type = CallsActionTypes.SET_VIEW_CALL_MODAL;
  constructor() {}
}

export class Done implements Action {
  readonly type = CallsActionTypes.DONE;
  constructor() {}
}

export class ShowCallImagesModal implements Action {
  readonly type = CallsActionTypes.SHOW_CALLIMAGES;
  constructor(public callId: string) {}
}

export class OpenCallImagesModal implements Action {
  readonly type = CallsActionTypes.OPEN_CALLIMAGES;
  constructor(public payload: CallFileResultData[]) {}
}

export class UploadCallImage implements Action {
  readonly type = CallsActionTypes.UPLOAD_CALLIMAGE;
  constructor(public callId: string, public userId: string, public name: string, public image: string) {}
}

export class UploadCallImageSuccess implements Action {
  readonly type = CallsActionTypes.UPLOAD_CALLIMAGE_SUCCESS;
  constructor() {}
}

export class UploadCallImageFail implements Action {
  readonly type = CallsActionTypes.UPLOAD_CALLIMAGE_FAIL;
  constructor() {}
}

export class ShowCallFilesModal implements Action {
  readonly type = CallsActionTypes.SHOW_CALLFILESMODAL;
  constructor(public callId: string) {}
}

export class OpenCallFilesModal implements Action {
  readonly type = CallsActionTypes.OPEN_CALLFILESMODAL;
  constructor(public payload: CallFileResultData[]) {}
}

export class UploadCallFile implements Action {
  readonly type = CallsActionTypes.UPLOAD_CALLFILE;
  constructor(public callId: string, public userId: string, public name: string, public image: string) {}
}

export class UploadCallFileSuccess implements Action {
  readonly type = CallsActionTypes.UPLOAD_CALLFILE_SUCCESS;
  constructor() {}
}

export class UploadCallFileFail implements Action {
  readonly type = CallsActionTypes.UPLOAD_CALLFILE_FAIL;
  constructor() {}
}

export type CallActionsUnion =
  | GetCalls
  | GetCallsDone
  | GetCallFail
  | GetCallById
  | GetCallByIdSuccess
  | GetCallByIdFailure
  | GetCallByIdDone
  | ShowCallNotesModal
  | OpenCallNotesModal
  | SaveCallNote
  | SaveCallNoteSuccess
  | SaveCallNoteFail
  | SetViewCallModal
  | ShowCallImagesModal
  | OpenCallImagesModal
  | UploadCallImage
  | UploadCallImageSuccess
  | UploadCallImageFail
  | ShowCallFilesModal
  | OpenCallFilesModal
  | UploadCallFile
  | UploadCallFileSuccess
  | UploadCallFileFail;
