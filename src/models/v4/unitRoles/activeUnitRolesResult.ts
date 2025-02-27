import { BaseV4Request } from "../baseV4Request";
import { ActiveUnitRoleResultData } from "./activeUnitRoleResultData";

export class ActiveUnitRolesResult extends BaseV4Request  {
    public Data: ActiveUnitRoleResultData[] = [];
}
