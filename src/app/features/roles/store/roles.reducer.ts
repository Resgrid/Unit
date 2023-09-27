import { initialState, RolesState } from './roles.store';
import { RolesActionTypes } from './roles.actions';

import * as _ from 'lodash';
import { RolesActionsUnion } from './roles.actions';

export function reducer(
  state: RolesState = initialState,
  action: RolesActionsUnion
): RolesState {
  switch (action.type) {
    case RolesActionTypes.GET_SET_ROLE_DATA_SUCCESS:
      return {
        ...state,
        roles: action.roles,
        unitRoleAssignments: action.unitRoleAssignments,
        users: action.users
      };
    default:
      return state;
  }
}
