/**
 * Payload of `GET /api/v4/Mapping/GetMapIconLegend`: every icon the department map can draw for calls, units and personnel,
 * built from the department's own call types, priorities, unit types, status sets and roles (names and uploads included).
 * Nothing here is fixed by the app: render what the server sends.
 */
export class GetMapIconLegendResultData {
  /** The status styles in legend order, then `unknown` last. */
  public StatusStyles: MapLegendStyleData[] = [];
  /** The priority styles (low, medium, high, emergency), then `unknown` last. */
  public PriorityStyles: MapLegendStyleData[] = [];
  /** First row (`Id` null) = calls with no type; then the call types by name. */
  public Calls: MapLegendRowData[] = [];
  /** First row (`Id` null) = units with no type; then the unit types by name. */
  public Units: MapLegendRowData[] = [];
  /** First row (`Id` null) = members with no role icon; then the roles that have an uploaded icon, in role order. */
  public Personnel: MapLegendRowData[] = [];
  /** The department's POI types by name. */
  public PoiTypes: MapLegendPoiTypeData[] = [];
}

/** A colour style: one per status meaning group, or one per priority level; `unknown` = no meaning (or no status). */
export class MapLegendStyleData {
  /** Style key: `available`, `dispatched`, `responding`, `onscene`, `transporting`, `returning`, `staging`, `delayed`, `unavailable`, `low`, `medium`, `high`, `emergency` or `unknown`. */
  public Key: string = '';
  /** The style colour, `#RRGGBB`. */
  public Color: string = '';
  /** The ActionBaseTypes the status style groups (not shown). */
  public Meanings: number[] = [];
  /** Status styles: the department's own unit status names (all status sets) drawn in this style. */
  public UnitStatuses: string[] = [];
  /** Status styles: the department's own personnel status names drawn in this style. */
  public PersonnelStatuses: string[] = [];
  /** Priority styles: the department's own priority names drawn in this style. */
  public Priorities: string[] = [];
  /** Status styles: the default unit pin in this style (absolute URL). */
  public UnitPinIconUrl: string | null = null;
  /** Status styles: the default person pin in this style (absolute URL). */
  public PersonPinIconUrl: string | null = null;
  /** Priority styles: the default call pin in this style (absolute URL). */
  public CallPinIconUrl: string | null = null;
}

/** One call type, unit type or role, with the icon it shows in each priority or status. */
export class MapLegendRowData {
  /** The call type / unit type / role id; null for the "none" row (no type, no role icon), which the app labels itself. */
  public Id: number | null = null;
  /** The department's name for the call type / unit type / role (ignored for the `Id` null row). */
  public Name: string = '';
  /** Units: the type's custom status set name; null = the built-in unit statuses. */
  public StatusSetName: string | null = null;
  /** The type's or role's own uploaded icon (no status), or null. */
  public IconUrl: string | null = null;
  /** Always null for rows. */
  public PinIconUrl: string | null = null;
  /** The bundled icon the type picked (`fire`, `ambulance`) or the default (`Call`, `Engine_Responding`, `Person_RespondingCall`). */
  public ImagePath: string = '';
  public States: MapLegendStateData[] = [];
}

/** The icon a row shows in one priority or status: the same `IconUrl` / `PinIconUrl` / `ImagePath` a map marker carries. */
export class MapLegendStateData {
  /** The stored priority id / status id. */
  public Id: number = 0;
  /** The department's own name for the priority / status. */
  public Name: string = '';
  /** The priority's / status's own colour (hex), or null. */
  public Color: string | null = null;
  /** Style key (`unknown` when the priority / status has no meaning). */
  public IconStyle: string = '';
  /** Upload for this exact state, or the type's own upload with a badge; null = none. */
  public IconUrl: string | null = null;
  /** Styled built-in pin (absolute URL): the fallback when `IconUrl` is null or fails to load. */
  public PinIconUrl: string | null = null;
  /** Bundled fallback icon name. */
  public ImagePath: string = '';
  /** True when `IconUrl` is an upload made for this exact state. */
  public IsVariant: boolean = false;
}

/** A department POI type, with the same icon fields its POI markers carry. */
export class MapLegendPoiTypeData {
  public PoiTypeId: number = 0;
  public Name: string = '';
  public Color: string | null = null;
  public PoiImage: string | null = null;
  public ImagePath: string | null = null;
  public Marker: string | null = null;
  public IconUrl: string | null = null;
}
