import { BaseV4Request } from "../baseV4Request";
import { GetRolesForCallGridResultData } from "./getRolesForCallGridResultData";

export class GetRolesForCallGridResult extends BaseV4Request  {
    public Data: GetRolesForCallGridResultData[] = [];
}
    