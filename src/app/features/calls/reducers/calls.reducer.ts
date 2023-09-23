import * as _ from 'lodash';
import { initialState, CallsState } from '../store/calls.store';
import { CallActionsUnion, CallsActionTypes } from '../actions/calls.actions';
import { CallAndPriorityData } from '../models/callAndPriorityData';
import { CallPriorityResultData } from '@resgrid/ngx-resgridlib';

export function reducer(
  state: CallsState = initialState,
  action: CallActionsUnion
): CallsState {
  switch (action.type) {
    case CallsActionTypes.GET_CALLS_DONE:
      let activeCalls: CallAndPriorityData[] = [];

      action.calls.forEach((call) => {
        let activePriority: CallPriorityResultData = null;
        const defaultPriority = _.find(action.priorities, ['Id', 0]);
        const priorityForCall = _.find(action.priorities, [
          'Id',
          call.Priority,
        ]);

        if (priorityForCall) {
          activePriority = priorityForCall;
        } else {
          activePriority = defaultPriority;
        }

        const callData: CallAndPriorityData = {
          Call: call,
          CallPriority: activePriority,
        };

        activeCalls.push(callData);
      });

      return {
        ...state,
        activeCalls: activeCalls,
      };
    case CallsActionTypes.GET_CALL_BYID_SUCCESS:
      let activePriority: CallPriorityResultData = null;
      const defaultPriority = _.find(action.priorities, ['Id', 0]);
      const priorityForCall = _.find(action.priorities, [
        'Id',
        action.call.Priority,
      ]);

      if (priorityForCall) {
        activePriority = priorityForCall;
      } else {
        activePriority = defaultPriority;
      }

      return {
        ...state,
        callToView: action.call,
        callViewData: action.data,
        callToViewPriority: activePriority,
        callFiles: [],
        callImages: [],
        callNotes: [],
        viewCallType: 'call',
      };
    case CallsActionTypes.OPEN_CALLNOTES:
      return {
        ...state,
        callNotes: action.payload,
        viewCallType: 'notes',
      };
    case CallsActionTypes.SET_VIEW_CALL_MODAL:
      return {
        ...state,
        viewCallType: 'call',
      };
    case CallsActionTypes.OPEN_CALLIMAGES:
      return {
        ...state,
        callImages: action.payload,
        viewCallType: 'images',
      };
    case CallsActionTypes.OPEN_CALLFILESMODAL:
      return {
        ...state,
        callFiles: action.payload,
        viewCallType: 'files',
      };
    default:
      return state;
  }
}

export const getCallImages = (state: CallsState) => state.callImages;
