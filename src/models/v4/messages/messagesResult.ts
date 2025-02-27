import { BaseV4Request } from "../baseV4Request";
import { MessageResultData } from "./messageResultData";

export class MessagesResult extends BaseV4Request  {
    public Data: MessageResultData[] = [];
}
