import { BaseV4Request } from "../baseV4Request";
import { FilterResultData } from "./filterResultData";

export class GetPersonnelFilterOptionsResult extends BaseV4Request  {
    public Data: FilterResultData[] = [];
}
