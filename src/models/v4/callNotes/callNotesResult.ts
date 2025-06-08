import { BaseV4Request } from "../baseV4Request";
import { CallNoteResultData } from "./callNoteResultData";

export class CallNotesResult extends BaseV4Request  {
    public Data: CallNoteResultData[] = [];
}
