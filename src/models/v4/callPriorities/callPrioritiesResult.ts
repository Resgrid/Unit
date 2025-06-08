import { ICacheable } from "../../cacheable";
import { BaseV4Request } from "../baseV4Request";
import { CallPriorityResultData } from "./callPriorityResultData";

export class CallPrioritiesResult extends BaseV4Request implements ICacheable {
    public cacheKey: string = 'CallPrioritiesResult';
    public cacheTime: number = 20160;
    public cacheSavedOn: Date | undefined = undefined;
    public cacheHitFailed: boolean = false;
    public cacheType: number = 1;
    
    public Data: CallPriorityResultData[] = [];
}
