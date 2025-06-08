import { BaseV4Request } from "../baseV4Request";
import { FilterResultData } from "../personnel/filterResultData";

export class GetUnitFilterOptionsResult extends BaseV4Request  {
    public Data: FilterResultData[] = [];
}
