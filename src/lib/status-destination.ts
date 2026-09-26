import { type CallResultData } from '@/models/v4/calls/callResultData';
import { DestinationEntityTypes } from '@/models/v4/destinations/destinationEntityTypes';
import { type UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

type UnitStatusDestination = Pick<UnitStatusResultData, 'UnitId' | 'DestinationId' | 'DestinationType'>;

/**
 * The call id the unit's latest server-side status points at, or null when that status has no
 * destination or its destination is a station/POI.
 *
 * Dispatching a unit writes a "Responding" status for it with the dispatched call as destination,
 * so this is how a crew that never set an active call still gets that call as the default.
 * Legacy rows carry no destination type (null/0); the server treats an untyped RespondingTo as a
 * call, so those count as a call here — callers still require the id to match an open call.
 */
export const getUnitStatusCallDestinationId = (unitStatus: UnitStatusDestination | null | undefined, unitId?: string | null): string | null => {
  if (!unitStatus) {
    return null;
  }

  // activeUnitStatus is refreshed asynchronously after a unit switch — never borrow another
  // unit's destination while it catches up.
  if (unitId && unitStatus.UnitId && String(unitStatus.UnitId) !== String(unitId)) {
    return null;
  }

  const destinationId = unitStatus.DestinationId == null ? '' : String(unitStatus.DestinationId).trim();
  if (destinationId === '' || destinationId === '0') {
    return null;
  }

  const rawType = unitStatus.DestinationType;
  const destinationType = rawType == null || rawType === '' ? DestinationEntityTypes.None : Number(rawType);

  if (destinationType !== DestinationEntityTypes.Call && destinationType !== DestinationEntityTypes.None) {
    return null;
  }

  return destinationId;
};

/**
 * The call a status should default to: the crew's active call when it is still open, otherwise
 * the open call the unit's latest status points at. Returns null when neither is in the list of
 * open calls — a closed call must never be offered, it would be rejected by the server.
 */
export const resolveDefaultStatusCall = ({
  availableCalls,
  activeCallId,
  unitStatus,
  unitId,
}: {
  availableCalls: CallResultData[];
  activeCallId: string | null | undefined;
  unitStatus: UnitStatusDestination | null | undefined;
  unitId?: string | null;
}): CallResultData | null => {
  if (activeCallId) {
    const activeCall = availableCalls.find((call) => call.CallId === activeCallId);
    if (activeCall) {
      return activeCall;
    }
  }

  const unitStatusCallId = getUnitStatusCallDestinationId(unitStatus, unitId);
  if (!unitStatusCallId) {
    return null;
  }

  return availableCalls.find((call) => String(call.CallId) === unitStatusCallId) ?? null;
};
