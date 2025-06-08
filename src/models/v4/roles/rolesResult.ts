import { BaseV4Request } from "../baseV4Request";
import { RoleResultData } from "./roleResultData";

export class RolesResult extends BaseV4Request  {
    public Data: RoleResultData[] = [];
}
