import { BaseV4Request } from "../baseV4Request";
import { NoteResultData } from "./noteResultData";

export class NotesResult extends BaseV4Request  {
    public Data: NoteResultData[] = [];
}
