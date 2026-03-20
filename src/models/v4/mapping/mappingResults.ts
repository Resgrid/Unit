import { type FeatureCollection } from 'geojson';

import { BaseV4Request } from '../baseV4Request';
import { type CustomMapResultData } from './customMapResultData';
import { type IndoorMapFloorResultData, type IndoorMapResultData } from './indoorMapResultData';

export class GetIndoorMapsResult extends BaseV4Request {
  public Data: IndoorMapResultData[] = [];
}

export class GetIndoorMapResult extends BaseV4Request {
  public Data: IndoorMapResultData = {} as IndoorMapResultData;
}

export class GetIndoorMapFloorResult extends BaseV4Request {
  public Data: IndoorMapFloorResultData = {} as IndoorMapFloorResultData;
}

export class GetCustomMapsResult extends BaseV4Request {
  public Data: CustomMapResultData[] = [];
}

export class GetCustomMapResult extends BaseV4Request {
  public Data: CustomMapResultData = {} as CustomMapResultData;
}

export class GetCustomMapLayerResult extends BaseV4Request {
  public Data: CustomMapResultData = {} as CustomMapResultData;
}

export class GetGeoJSONResult extends BaseV4Request {
  public Data: FeatureCollection = { type: 'FeatureCollection', features: [] };
}

export interface ActiveLayerSummary {
  LayerId: string;
  Name: string;
  Type: string;
  Color: string;
  IsOnByDefault: boolean;
  Source: 'indoor' | 'custom';
  MapId: string;
}

export class GetAllActiveLayersResult extends BaseV4Request {
  public Data: ActiveLayerSummary[] = [];
}

export interface UnifiedSearchResultItem {
  Type: 'indoor_zone' | 'custom_region';
  Id: string;
  Name: string;
  MapId: string;
  FloorId: string;
  LayerId: string;
  Latitude: number;
  Longitude: number;
}

export class SearchAllMapFeaturesResult extends BaseV4Request {
  public Data: UnifiedSearchResultItem[] = [];
}

export class SearchIndoorLocationsResult extends BaseV4Request {
  public Data: UnifiedSearchResultItem[] = [];
}

export class SearchCustomMapRegionsResult extends BaseV4Request {
  public Data: UnifiedSearchResultItem[] = [];
}
