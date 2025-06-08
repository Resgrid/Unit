import { CallPriorityResultData } from "../callPriorities/callPriorityResultData";
import { CallTypeResultData } from "../callTypes/callTypeResultData";
import { CustomStatusResultData } from "../customStatuses/customStatusResultData";
import { GroupResultData } from "../groups/groupsResultData";
import { PersonnelInfoResultData } from "../personnel/personnelInfoResultData";
import { RoleResultData } from "../roles/roleResultData";
import { UnitRoleResultData } from "../unitRoles/unitRoleResultData";
import { UnitResultData } from "../units/unitResultData";
import { UnitStatusResultData } from "../unitStatus/unitStatusResultData";

export class NewCallFormResultData  {
    public Personnel: PersonnelInfoResultData[] = [];
    public Groups: GroupResultData[] = [];
    public Units: UnitResultData[] = [];
    public Roles: RoleResultData[] = [];
    public Statuses: CustomStatusResultData[] = [];
    public UnitStatuses: UnitStatusResultData[] = [];
    public UnitRoles: UnitRoleResultData[] = [];
    public Priorities: CallPriorityResultData[] = [];
    public CallTypes: CallTypeResultData[] = [];
}
