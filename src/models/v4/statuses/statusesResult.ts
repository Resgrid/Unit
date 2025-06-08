import { BaseV4Request } from "../baseV4Request";
import { StatusesResultData } from "./statusesResultData";

export class StatusesResult extends BaseV4Request  {
    public Data: StatusesResultData[] = [];
}
