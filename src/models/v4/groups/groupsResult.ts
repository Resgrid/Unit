import { BaseV4Request } from "../baseV4Request";
import { GroupResultData } from "./groupsResultData";

export class GroupsResult extends BaseV4Request  {
    public Data: GroupResultData[] = [];
}
