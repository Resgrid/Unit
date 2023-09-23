import { CallPriorityResultData, CallResultData, CallTypeResultData, DepartmentRightsResult, FormResultData, GetConfigResultData, GetPersonnelForCallGridResultData, GetRolesForCallGridResultData, GroupResultData, UnitResultData, UnitStatusResultData, UnitTypeStatusResultData } from '@resgrid/ngx-resgridlib';
import { ActiveUnitRoleResultData } from '@resgrid/ngx-resgridlib/lib/models/v4/unitRoles/activeUnitRoleResultData';

export class AppPayload {
    public Units: UnitResultData[];
    public Calls: CallResultData[];
    public CallPriorties: CallPriorityResultData[];
    public CallTypes: CallTypeResultData[];
    public UnitStatuses: UnitTypeStatusResultData[];
    public UnitRoleAssignments: ActiveUnitRoleResultData[];
    public Groups: GroupResultData[];
    public ActiveUnitId: string = '';
    public ActiveCallId: string = '';
    public IsMobileApp: boolean = false;
    public Config: GetConfigResultData;
    public Rights: DepartmentRightsResult;
}