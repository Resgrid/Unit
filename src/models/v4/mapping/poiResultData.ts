export class PoiTypeResultData {
  public PoiTypeId: number = 0;
  public Name: string = '';
  public Color: string = '';
  public ImagePath: string = '';
  public PoiImage: string = '';
  public Marker: string = '';
  public IsDestination: boolean = false;
  /** Absolute URL of the department's uploaded icon for the POI type (128x128 PNG, anonymous, immutable); null/absent when none or on older servers. */
  public IconUrl?: string | null = null;
}

export class PoiResultData {
  public PoiId: number = 0;
  public PoiTypeId: number = 0;
  public PoiTypeName: string = '';
  public Name: string = '';
  public Address: string = '';
  public Note: string = '';
  public Latitude: number = 0;
  public Longitude: number = 0;
  public Color: string = '';
  public ImagePath: string = '';
  public Marker: string = '';
  public IsDestination: boolean = false;
  /** Absolute URL of the department's uploaded icon for the POI type (128x128 PNG, anonymous, immutable); null/absent when none or on older servers. */
  public IconUrl?: string | null = null;
}

export class PoiLayerData {
  public PoiTypeId: number = 0;
  public Name: string = '';
  public Color: string = '';
  public ImagePath: string = '';
  public PoiImage: string = '';
  public Marker: string = '';
  public IsDestination: boolean = false;
  /** Absolute URL of the department's uploaded icon for the POI type (128x128 PNG, anonymous, immutable); null/absent when none or on older servers. */
  public IconUrl?: string | null = null;
}
