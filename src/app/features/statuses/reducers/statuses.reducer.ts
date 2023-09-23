import * as _ from 'lodash';
import { initialState, StatusesState } from '../store/statuses.store';
import {
  StatusesActionsUnion,
  StatusesActionTypes,
} from '../actions/statuses.actions';

export function reducer(
  state: StatusesState = initialState,
  action: StatusesActionsUnion
): StatusesState {
  switch (action.type) {
    case StatusesActionTypes.SUBMIT_UNIT_STATUS_START:
      let setStatusType = 0;

      if (action.status) {
        //None = 0,
        //Stations = 1,
        //Calls = 2,
        //CallsAndStations = 3
        setStatusType = action.status.Detail;
      }

      return {
        ...state,
        submittingUnitStatus: action.status,
        submittingUnitStatusModalDisplay: setStatusType,
      };
    case StatusesActionTypes.SUBMIT_UNIT_STATUS_DESTINATION:
      return {
        ...state,
        submitStatusDestinations: action.destinations,
      };
    case StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE_SET:
      return {
        ...state,
        submittingUnitStatusNote: action.note,
      };
    case StatusesActionTypes.SUBMIT_UNIT_STATUS_DESTINATION_SET:
      return {
        ...state,
        submitStatusDestination: action.destination,
      };
    case StatusesActionTypes.SUBMIT_UNIT_STATUS_SET_DONE:
      return {
        ...state,
        submittingUnitStatus: null,
        submittingUnitStatusUnitId: null,
        submittingUnitStatusModalDisplay: 0,
        submitStatusDestinations: null,
        submittingUnitStatusNote: null,
        submitStatusDestination: null
      };
    default:
      return state;
  }
}
