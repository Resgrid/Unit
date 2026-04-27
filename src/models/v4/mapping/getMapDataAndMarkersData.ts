import { PoiLayerData } from './poiResultData';

export class MapDataAndMarkersData {
  public CenterLat: number | string = 0;
  public CenterLon: number | string = 0;
  public ZoomLevel: number | string = 0;
  public MapMakerInfos: MapMakerInfoData[] = [];
  public PoiLayers?: PoiLayerData[] = [];
}

export class MapMakerInfoData {
  public Id: string = '';
  public Longitude: number = 0;
  public Latitude: number = 0;
  public Title: string = '';
  public zIndex: number | string = 0;
  public ImagePath: string = '';
  public InfoWindowContent: string = '';
  public Color: string = '';
  public Type: number = 0;
  public Marker?: string = '';
  public PoiTypeId?: number | null = null;
  public PoiTypeName?: string = '';
  public Address?: string = '';
  public Note?: string = '';
  public LayerId?: string = '';
  public LayerName?: string = '';
}
