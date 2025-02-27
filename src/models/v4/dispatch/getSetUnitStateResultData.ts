import { CallResultData } from "../calls/callResultData";
import { CustomStatusResultData } from "../customStatuses/customStatusResultData";
import { GroupResultData } from "../groups/groupsResultData";

export class GetSetUnitStateResultData  {
    public UnitId: string = '';
    public UnitName: string = '';
    public Stations: GroupResultData[] = [];
    public Calls: CallResultData[] = [];
    public Statuses: CustomStatusResultData[] = [];
}