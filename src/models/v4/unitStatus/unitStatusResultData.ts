export class UnitStatusResultData {
  public UnitId: string = '';
  public Name: string = '';
  public Type: string = '';
  public State: string = '';
  /** Id of the current status option (matches StatusesResultData.Id); 0/missing on older servers. */
  public StateId?: number | string | null = null;
  public StateCss: string = '';
  public StateStyle: string = '';
  public Timestamp: string = '';
  public TimestampUtc?: string = '';
  public DestinationId?: number | string | null = null;
  public DestinationType?: number | string | null = null;
  public DestinationName?: string = '';
  public DestinationAddress?: string = '';
  public DestinationTypeName?: string = '';
  public Note: string = '';
  public Latitude: number | string | null = null;
  public Longitude: number | string | null = null;
  public GroupName: string = '';
  public GroupId: number | string = '';
  public Eta: string = '';
  /** Absolute URL of the department's uploaded icon for this unit's type (128x128 PNG, anonymous, immutable); null/absent when none or on older servers. */
  public TypeIconUrl?: string | null = null;
  /** Built-in map icon the unit's type picked, lowercase `MAP_ICONS` key (e.g. "ambulance"); null/absent when none or on older servers. */
  public TypeMapIcon?: string | null = null;
}
