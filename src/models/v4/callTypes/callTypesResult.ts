import { BaseV4Request } from "../baseV4Request";
import { CallTypeResultData } from "./callTypeResultData";

export class CallTypesResult extends BaseV4Request {
    public Data: CallTypeResultData[] = [];
}
