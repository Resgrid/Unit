export interface IndoorMapResultData {
  IndoorMapId: string;
  DepartmentId: string;
  Name: string;
  Description: string;
  CenterLatitude: number;
  CenterLongitude: number;
  BoundsNELatitude: number;
  BoundsNELongitude: number;
  BoundsSWLatitude: number;
  BoundsSWLongitude: number;
  BoundsGeoJson: string;
  IsActive: boolean;
  CreatedOn: string;
  UpdatedOn: string;
  Floors: IndoorMapFloorResultData[];
}

export interface IndoorMapFloorResultData {
  IndoorMapFloorId: string;
  IndoorMapId: string;
  Name: string;
  FloorOrder: number;
  Opacity: number;
  HasImage: boolean;
  CreatedOn: string;
  Zones: IndoorMapZoneResultData[];
}

export interface IndoorMapZoneResultData {
  IndoorMapZoneId: string;
  IndoorMapFloorId: string;
  Name: string;
  Description: string;
  Type: string;
  Color: string;
  GeoJson: string;
  IsSearchable: boolean;
  IsDispatchable: boolean;
  CreatedOn: string;
}
