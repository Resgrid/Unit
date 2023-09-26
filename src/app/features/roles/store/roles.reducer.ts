import { initialState, RolesState } from './roles.store';
import { RolesActionTypes } from './roles.actions';

import * as _ from 'lodash';
import { RolesActionsUnion } from './roles.actions';

export function reducer(
  state: RolesState = initialState,
  action: RolesActionsUnion
): RolesState {
  switch (action.type) {
    default:
      return state;
  }
}
