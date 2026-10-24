export class RecipientsResultData {
  public Id: string = '';
  public Type: string = '';
  public Name: string = '';
  public Selected: boolean = false;
  /** Rows with Type "Unit" only: uploaded icon URL for the unit's type; null/absent otherwise or on older servers. */
  public TypeIconUrl?: string | null = null;
  /** Rows with Type "Unit" only: built-in map icon name (lowercase `MAP_ICONS` key) for the unit's type. */
  public TypeMapIcon?: string | null = null;
}
