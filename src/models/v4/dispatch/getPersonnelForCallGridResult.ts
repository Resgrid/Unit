import { BaseV4Request } from "../baseV4Request";
import { GetPersonnelForCallGridResultData } from "./getPersonnelForCallGridResultData";

export class GetPersonnelForCallGridResult extends BaseV4Request  {
    public Data: GetPersonnelForCallGridResultData[] = [];
}
