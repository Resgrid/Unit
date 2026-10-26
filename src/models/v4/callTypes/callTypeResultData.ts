export class CallTypeResultData {
  public Id: string = '';
  public Name: string = '';
  /** What kind of call the type is (CallTypeClasses); -1 none, undefined from older servers. */
  public BaseType?: number;
  /** Absolute URL of the department's uploaded icon for this call type; null/absent when none or on older servers. */
  public IconUrl?: string | null = null;
  /** Built-in icon this call type picked, lowercase `MAP_ICONS` key (e.g. "fire"); null/absent when none or on older servers. */
  public MapIcon?: string | null = null;
}
