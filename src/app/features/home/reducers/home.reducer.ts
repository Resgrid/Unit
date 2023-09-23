import {
  CallPriorityResultData,
  CallResultData,
  UnitResultData,
  UnitTypeStatusResultData,
} from '@resgrid/ngx-resgridlib';
import { HomeActionsUnion, HomeActionTypes } from '../actions/home.actions';
import { HomeState, initialState } from '../store/home.store';
import * as _ from 'lodash';

export function reducer(
  state: HomeState = initialState,
  action: HomeActionsUnion
): HomeState {
  switch (action.type) {
    case HomeActionTypes.LOADING_MAP:
      return {
        ...state,
      };
    case HomeActionTypes.LOADING_MAP_SUCCESS:
      return {
        ...state,
        mapData: action.payload,
      };
    case HomeActionTypes.LOADING_MAP_FAIL:
      return {
        ...state,
      };
    case HomeActionTypes.GEOLOCATION_LOCATION_UPDATE:
      return {
        ...state,
        currentPosition: action.payload,
      };
    case HomeActionTypes.GEOLOCATION_LOCATION_UPDATE_SENT:
      return {
        ...state,
        currentPositionTimestamp: new Date(),
      };
    case HomeActionTypes.LOADING_APP_DATA_SUCCESS:
      let activeUnit: UnitResultData = null;
      let activeStatuses: UnitTypeStatusResultData = null;
      let activeCall: CallResultData = null;
      let activePriority: CallPriorityResultData = null;

      if (action.payload.ActiveUnitId) {
        activeUnit = _.find(action.payload.Units, [
          'UnitId',
          action.payload.ActiveUnitId,
        ]);

        const defaultStatuses = _.find(action.payload.UnitStatuses, [
          'UnitType',
          '0',
        ]);

        if (activeUnit && activeUnit.Type){
          const statusesForType = _.find(action.payload.UnitStatuses, [
            'UnitType',
            activeUnit.Type.toString(),
          ]);

          if (statusesForType) {
            activeStatuses = statusesForType;
          } else {
            activeStatuses = defaultStatuses;
          }
        } else {
          activeStatuses = defaultStatuses;
        }
      }

      if (action.payload.ActiveCallId) {
        activeCall = _.find(action.payload.Calls, [
          'CallId',
          action.payload.ActiveCallId,
        ]);

        const defaultPriority = _.find(action.payload.CallPriorties, ['Id', 0]);

        if (activeCall) {
          const priorityForCall = _.find(action.payload.CallPriorties, [
            'Id',
            activeCall.Priority,
          ]);

          if (priorityForCall) {
            activePriority = priorityForCall;
          } else {
            activePriority = defaultPriority;
          }
        } else {
          activePriority = defaultPriority;
        }
      }

      return {
        ...state,
        units: action.payload.Units,
        calls: action.payload.Calls,
        callPriorties: action.payload.CallPriorties,
        callTypes: action.payload.CallTypes,
        unitStatuses: action.payload.UnitStatuses,
        unitRoleAssignments: action.payload.UnitRoleAssignments,
        groups: action.payload.Groups,
        activeUnit: activeUnit,
        activeStatuses: activeStatuses,
        activeCall: activeCall,
        activePriority: activePriority,
        isMobileApp: action.payload.IsMobileApp,
        config: action.payload.Config,
				rights: action.payload.Rights,
      };
    case HomeActionTypes.SET_ACTIVEUNIT:
      return {
        ...state,
        activeUnit: action.unit,
        activeStatuses: action.statuses,
      };
    case HomeActionTypes.SET_ACTIVECALL:
      return {
        ...state,
        activeCall: action.call,
        activePriority: action.priority,
      };
    case HomeActionTypes.GET_CURRENT_STATUS_SET:
      return {
        ...state,
        currentStatus: action.status,
      };
      case HomeActionTypes.GET_CURRENT_ROLES_SET:
        return {
          ...state,
          roles: action.roles,
        };
    case HomeActionTypes.REFRESH_MAP_DATA:
      const now = new Date()

      return {
        ...state,
        mapDataTimestamp: now.toUTCString(),
      };
    case HomeActionTypes.PUSH_CALLRECEIVED:
      return {
        ...state,
        pushData: action.pushData,
      };
    default:
      return state;
  }
}

export const getCurrentPositionState = (state: HomeState) =>
  state.currentPosition;
export const getCurrentUnitStatus = (state: HomeState) => state.currentStatus;
export const getActiveUnit = (state: HomeState) => state.activeUnit;
export const getLastMapDataUpdate = (state: HomeState) => state.mapDataTimestamp;
export const getPushData = (state: HomeState) => state.pushData;
export const getConfigData = (state: HomeState) => state.config;