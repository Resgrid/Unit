import { BaseV4Request } from "../baseV4Request";
import { CallNoteTemplateResultData } from "./callNoteTemplateResultData";

export class CallNoteTemplatesResult extends BaseV4Request  {
    public Data: CallNoteTemplateResultData[] = [];
}
