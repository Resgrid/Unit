import { BaseV4Request } from "../baseV4Request";
import { AutofillResultData } from "./autofillsResultData";

export class AutofillsResult extends BaseV4Request  {
    public Data: AutofillResultData[] = [];
}
