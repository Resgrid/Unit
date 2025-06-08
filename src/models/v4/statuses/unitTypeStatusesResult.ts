import { BaseV4Request } from "../baseV4Request";
import { UnitTypeStatusResultData } from "./unitTypeStatusResultData";

export class UnitTypeStatusesResult extends BaseV4Request  {
    public Data: UnitTypeStatusResultData[] = [];
}
