import { BaseV4Request } from '../baseV4Request';
import { PoiResultData, type PoiTypeResultData } from './poiResultData';

export class PoiResult extends BaseV4Request {
  public Data: PoiResultData = new PoiResultData();
}

export class PoisResult extends BaseV4Request {
  public Data: PoiResultData[] = [];
}

export class PoiTypesResult extends BaseV4Request {
  public Data: PoiTypeResultData[] = [];
}
