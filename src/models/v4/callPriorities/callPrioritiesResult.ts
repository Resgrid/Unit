import { BaseV4Request } from "../baseV4Request";
import { CallPriorityResultData } from "./callPriorityResultData";

export class CallPrioritiesResult extends BaseV4Request {
    public Data: CallPriorityResultData[] = [];
}
