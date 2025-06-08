import { BaseV4Request } from "../baseV4Request";
import { CallResultData } from "./callResultData";

export class ScheduledCallsResult extends BaseV4Request  {
    public Data: CallResultData[] = [];
}
