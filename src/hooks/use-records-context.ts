import { useMemo } from 'react';

import { type FieldRecordContextInput } from '@/models/v4/records';
import { useCoreStore } from '@/stores/app/core-store';

/**
 * The field context this app authors in (RMS plan RMS-1D). Unit authors against the apparatus this
 * device is signed on to, plus the Call it is working when there is one. The server checks that the
 * member is actually staffed on that unit before it offers a Unit-surface definition, so a stale id
 * here narrows the catalog rather than widening it.
 */
export const useRecordsContext = (): FieldRecordContextInput => {
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const activeCallId = useCoreStore((state) => state.activeCallId);

  return useMemo(() => {
    const context: FieldRecordContextInput = {};
    const unitId = activeUnitId ? Number.parseInt(activeUnitId, 10) : Number.NaN;
    if (Number.isFinite(unitId) && unitId > 0) {
      context.UnitId = unitId;
    }
    const callId = activeCallId ? Number.parseInt(activeCallId, 10) : Number.NaN;
    if (Number.isFinite(callId) && callId > 0) {
      context.CallId = callId;
    }
    return context;
  }, [activeUnitId, activeCallId]);
};
