import { BaseV4Request } from "../baseV4Request";
import { CallFileResultData } from "./callFileResultData";

export class CallFilesResult extends BaseV4Request  {
    public Data: CallFileResultData[] = [];
}
