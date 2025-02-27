import { BaseV4Request } from "../baseV4Request";
import { UnitStatusResultData } from "./unitStatusResultData";

export class UnitStatusesResult extends BaseV4Request  {
    public Data: UnitStatusResultData[] = [];
}
