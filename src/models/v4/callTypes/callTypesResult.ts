import { ICacheable } from "../../cacheable";
import { BaseV4Request } from "../baseV4Request";
import { CallTypeResultData } from "./callTypeResultData";

export class CallTypesResult extends BaseV4Request implements ICacheable  {
    public cacheKey: string = 'CallTypesResult';
    public cacheTime: number = 20160;
    public cacheSavedOn: Date | undefined = undefined;
    public cacheHitFailed: boolean = false;
    public cacheType: number = 1;

    public Data: CallTypeResultData[] = [];
}
