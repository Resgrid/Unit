import { StatusDestinationSources } from '@/models/v4/calls/statusDestinationSources';

/** The marker a call activity entry carries: `auto` (auto-linked) or `inferred`. */
export type ActivityLinkKind = 'auto' | 'inferred';

/**
 * Which marker a call activity entry gets from its `DestinationSource`.
 *
 * - CarryForward / Dispatch / Unit → `auto`: sent without a call, and the server linked it from the
 *   previous status, the one open dispatch, or the unit the person rode.
 * - Inferred → `inferred`: a unit/person dispatched to the call set it with no destination while
 *   working it.
 * - Explicit, null/undefined (older rows, non-status entries) and unknown values → null (no marker).
 */
export const getActivityLinkKind = (source: number | string | null | undefined): ActivityLinkKind | null => {
  if (source === null || source === undefined || source === '') {
    return null;
  }

  switch (Number(source)) {
    case StatusDestinationSources.CarryForward:
    case StatusDestinationSources.Dispatch:
    case StatusDestinationSources.Unit:
      return 'auto';
    case StatusDestinationSources.Inferred:
      return 'inferred';
    default:
      return null;
  }
};
