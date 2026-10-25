import { type PoiLayerData } from './poiResultData';

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
  public PoiImage: string = '';
  public PoiTypeId?: number | null = null;
  public PoiTypeName?: string = '';
  public Address?: string = '';
  public Note?: string = '';
  public LayerId?: string = '';
  public LayerName?: string = '';
  /**
   * Uploaded icon URL: for unit, call and POI pins (Types 1, 0 and 4) the pin's type's icon; for a personnel pin (Type 3)
   * the icon of the first role the person holds, in the department's role order, that has one. Null/absent when none or on older servers.
   */
  public IconUrl?: string | null = null;
  /**
   * Absolute URL of the built-in pin recoloured to the call's priority or the unit's/person's status: the same 32x37 shape,
   * size and anchor as the bundled `ImagePath` pin. Null for stations, POIs and hydrants, when the priority/status has no
   * meaning, or on older servers.
   */
  public PinIconUrl?: string | null = null;
  /** Style key behind `PinIconUrl` (a status such as `responding`, or a priority such as `high`); null whenever `PinIconUrl` is. */
  public IconStyle?: string | null = null;
}
