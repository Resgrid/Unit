import { ActiveUnitRoleResultData, NoteCategoryResultData, NoteResultData, PersonnelInfoResultData, UnitRoleResultData } from "@resgrid/ngx-resgridlib";

export interface RolesState {
    roles: UnitRoleResultData[];
    unitRoleAssignments: ActiveUnitRoleResultData[];
    users: PersonnelInfoResultData[];
}

export const initialState: RolesState = {
    roles: null,
    unitRoleAssignments: null,
    users: null
};