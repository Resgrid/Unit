/**
 * How a status entry on a call's activity got linked to that call (server `StatusDestinationSources`).
 */
export enum StatusDestinationSources {
  /** The sender chose the call. */
  Explicit = 1,
  /** Sent without a call; linked from the sender's previous status. */
  CarryForward = 2,
  /** Sent without a call; linked from the one open dispatch. */
  Dispatch = 3,
  /** Sent without a call; linked from the unit the person rode. */
  Unit = 4,
  /** Set with no destination by a unit or person dispatched to the call while working it. */
  Inferred = 5,
}
