import { BaseV4Request } from "../baseV4Request";
import { UnitInfoResultData } from "./unitInfoResultData";

export class UnitsInfoResult extends BaseV4Request  {
    public Data: UnitInfoResultData[] = [];
}
