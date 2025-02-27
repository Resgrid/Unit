import { BaseV4Request } from "../baseV4Request";
import { GetAllCalendarItemTypesResult } from "./calendarItemTypeResultData";

export class CalendarItemTypesResult extends BaseV4Request  {
    public Data: GetAllCalendarItemTypesResult[] = [];
}
