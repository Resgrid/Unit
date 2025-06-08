import { ICacheable } from "../../cacheable";
import { BaseV4Request } from "../baseV4Request";
import { GroupResultData } from "./groupsResultData";

export class GroupsResult extends BaseV4Request implements ICacheable  {
    public cacheKey: string = 'GroupsResult';
    public cacheTime: number = 20160;
    public cacheSavedOn: Date | undefined = undefined;
    public cacheHitFailed: boolean = false;
    public cacheType: number = 1;

    public Data: GroupResultData[] = [];
}
