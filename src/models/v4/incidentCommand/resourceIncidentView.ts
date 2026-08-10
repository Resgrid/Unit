// Enum values mirror the server's IncidentCommand enums. Numeric values MUST stay in sync
// with the backend (they are persisted and sent over the wire).

export enum TacticalObjectiveType {
  General = 0,
  Benchmark = 1,
  Safety = 2,
}

export enum TacticalObjectiveStatus {
  Pending = 0,
  Complete = 1,
  InProgress = 2,
}

export enum IncidentNeedCategory {
  Resource = 0,
  Logistics = 1,
  Medical = 2,
  Equipment = 3,
  Staffing = 4,
  Other = 5,
}

export enum IncidentNeedStatus {
  Open = 0,
  PartiallyMet = 1,
  Met = 2,
  Cancelled = 3,
}

export class IncidentContactInfo {
  public UserId?: string | null = null;
  public Name: string = '';
  public Phone?: string | null = null;
  public Email?: string | null = null;
}

export class TacticalObjective {
  public TacticalObjectiveId: string = '';
  public IncidentCommandId: string = '';
  public DepartmentId: number = 0;
  public CallId: number = 0;
  public Name: string = '';
  public ObjectiveType: TacticalObjectiveType = TacticalObjectiveType.General;
  public Status: TacticalObjectiveStatus = TacticalObjectiveStatus.Pending;
  public AutoPopulated: boolean = false;
  public CompletedByUserId?: string | null = null;
  public CompletedOn?: string | null = null;
  public Description?: string | null = null;
  public ProgressPercent: number = 0;
  public Priority: number = 0;
  public TargetCompleteOn?: string | null = null;
  public SortOrder: number = 0;
  public ModifiedOn?: string | null = null;
}

export class IncidentNeed {
  public IncidentNeedId: string = '';
  public IncidentCommandId: string = '';
  public DepartmentId: number = 0;
  public CallId: number = 0;
  public Name: string = '';
  public Description?: string | null = null;
  public Category: IncidentNeedCategory = IncidentNeedCategory.Resource;
  public Status: IncidentNeedStatus = IncidentNeedStatus.Open;
  public QuantityRequested: number = 0;
  public QuantityFulfilled: number = 0;
  public Priority: number = 0;
  public CreatedByUserId?: string | null = null;
  public CreatedOn: string = '';
  public MetByUserId?: string | null = null;
  public MetOn?: string | null = null;
  public SortOrder: number = 0;
  public ModifiedOn?: string | null = null;
}

export class IncidentNote {
  public IncidentNoteId: string = '';
  public IncidentCommandId: string = '';
  public DepartmentId: number = 0;
  public CallId: number = 0;
  public NoteType: number = 0;
  public Visibility: number = 0;
  public Title?: string | null = null;
  public Body: string = '';
  public ContainmentPercent?: number | null = null;
  public CreatedByUserId: string = '';
  public CreatedOn: string = '';
  public DeletedOn?: string | null = null;
  public ModifiedOn?: string | null = null;
}

export class IncidentAttachment {
  public IncidentAttachmentId: string = '';
  public IncidentCommandId: string = '';
  public DepartmentId: number = 0;
  public CallId: number = 0;
  public Visibility: number = 0;
  public FileName: string = '';
  public ContentType: string = '';
  public ContentLength: number = 0;
  public Description?: string | null = null;
  public UploadedByUserId: string = '';
  public UploadedOn: string = '';
  public DeletedOn?: string | null = null;
  public ModifiedOn?: string | null = null;
}

export class ResourceLaneAssignmentView {
  public ResourceAssignmentId: string = '';
  public CommandStructureNodeId: string = '';
  public LaneName: string = '';
  public NodeType: number = 0;
  public Color?: string | null = null;
  public AssignedOn: string = '';
  public PrimaryLead?: IncidentContactInfo | null = null;
  public SecondaryLead?: IncidentContactInfo | null = null;
  public PrimaryObjective?: TacticalObjective | null = null;
  public SecondaryObjective?: TacticalObjective | null = null;
  public LinkedNeed?: IncidentNeed | null = null;
}

/** Who holds an ICS position on the incident, with the contact details to reach them. */
export class IncidentRoleContactInfo {
  /** Maps to IncidentRoleType. */
  public RoleType: number = 0;
  public Contact?: IncidentContactInfo | null = null;
}

/**
 * The incident's chat channels, already filtered by the server to the ones this caller may open.
 * A null id means "not available to you" — not command staff, not a lane lead, or not provisioned.
 * Never infer access from anything else: if the id isn't here, the channel will reject you.
 */
export class IncidentChatChannels {
  /** Call-wide incident channel (everyone on the call). */
  public IncidentChannelId?: string | null = null;
  /** Private command channel — command staff (IC or an ICS role holder) only. */
  public CommandChannelId?: string | null = null;
  /** "All Leads" channel — the IC and lane primary/secondary leads only. */
  public LeadsChannelId?: string | null = null;
  /** The caller's own lane channel, when they are assigned to a lane. */
  public LaneChannelId?: string | null = null;
  /** True once the incident is closed: readable, but frozen as a point-in-time record. */
  public IsFrozen: boolean = false;
}

export class ResourceIncidentView {
  public IncidentCommandId: string = '';
  public CallId: number = 0;
  public Status: number = 0;
  public EstablishedOn: string = '';
  public EstimatedEndOn?: string | null = null;
  public ClosedOn?: string | null = null;
  public ImportantInformation?: string | null = null;
  public IncidentActionPlan?: string | null = null;
  public Commander?: IncidentContactInfo | null = null;
  public Objectives: TacticalObjective[] = [];
  public Needs: IncidentNeed[] = [];
  public Notes: IncidentNote[] = [];
  public Attachments: IncidentAttachment[] = [];
  public MyAssignment?: ResourceLaneAssignmentView | null = null;
  /** ICS positions filled on this incident, so a crew can reach the right person directly. */
  public Roles?: IncidentRoleContactInfo[] = [];
  /** Chat channels this caller may open. */
  public Chat?: IncidentChatChannels | null = null;
}
