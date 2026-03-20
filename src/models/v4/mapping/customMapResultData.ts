export interface CustomMapResultData {
  CustomMapId: string;
  DepartmentId: string;
  Name: string;
  Description: string;
  Type: number;
  CenterLatitude: number;
  CenterLongitude: number;
  ZoomLevel: number;
  IsActive: boolean;
  CreatedOn: string;
  UpdatedOn: string;
  Layers: CustomMapLayerResultData[];
}

export interface CustomMapLayerResultData {
  CustomMapLayerId: string;
  CustomMapId: string;
  Name: string;
  Type: number;
  Color: string;
  Opacity: number;
  IsSearchable: boolean;
  IsOnByDefault: boolean;
  HasImage: boolean;
  HasTiles: boolean;
  BoundsNELatitude: number;
  BoundsNELongitude: number;
  BoundsSWLatitude: number;
  BoundsSWLongitude: number;
  GeoJson: string;
  CreatedOn: string;
  UpdatedOn: string;
}

export enum CustomMapType {
  Outdoor = 0,
  Event = 1,
  General = 2,
}
