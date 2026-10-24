export class RoleResultData {
  public RoleId: string = '';
  public Name: string = '';
  /** The department's uploaded icon for this role; null/absent when none or on older servers. */
  public IconUrl?: string | null = null;
  /** The role's position in the department's role order (lowest first); absent on older servers. */
  public SortOrder?: number;
}
