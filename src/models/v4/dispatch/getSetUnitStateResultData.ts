import { type CallResultData } from '../calls/callResultData';
import { type CustomStatusResultData } from '../customStatuses/customStatusResultData';
import { type GroupResultData } from '../groups/groupsResultData';
import { type PoiResultData, type PoiTypeResultData } from '../mapping/poiResultData';

export class GetSetUnitStateResultData {
  public UnitId: string = '';
  public UnitName: string = '';
  public Stations: GroupResultData[] = [];
  public Calls: CallResultData[] = [];
  public DestinationPois: PoiResultData[] = [];
  public PoiTypes: PoiTypeResultData[] = [];
  public Statuses: CustomStatusResultData[] = [];
}
