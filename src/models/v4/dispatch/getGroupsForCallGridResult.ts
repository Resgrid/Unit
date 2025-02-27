import { BaseV4Request } from "../baseV4Request";
import { GroupsForCallGridData } from "./getGroupsForCallGridResultData";

export class GetGroupsForCallGridResult extends BaseV4Request  {
    public Data: GroupsForCallGridData[] = [];
}
