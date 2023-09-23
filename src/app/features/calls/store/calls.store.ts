import { CallExtraDataResultData, CallFileResultData, CallNoteResultData, CallPriorityResultData, CallResultData } from '@resgrid/ngx-resgridlib';
import { CallAndPriorityData } from "../models/callAndPriorityData";

export interface CallsState {
    activeCalls: CallAndPriorityData[];

    callToView: CallResultData;
    callViewData: CallExtraDataResultData;
    callToViewPriority: CallPriorityResultData;

    viewCallType: string;
    callNotes: CallNoteResultData[];
    callImages: CallFileResultData[];
    callFiles: CallFileResultData[];
}

export const initialState: CallsState = {
    activeCalls: null,
    callToView: null,
    callViewData: null,
    callToViewPriority: null,
    viewCallType: 'call',
    callNotes: null,
    callImages: null,
    callFiles: null
};
