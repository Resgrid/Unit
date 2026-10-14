/**
 * Which status set (a GetAllUnitStatuses entry) a unit uses, and which of its options is the unit's current status.
 *
 * GetAllUnitStatuses lists the built-in statuses under UnitType '0' and then one entry per unit type that has a custom
 * status set, keyed by the unit type's NAME (`UnitType`) and the set's id (`StatusId`). A unit carries its unit type's
 * set id as `CustomStatusSetId` ('0' / empty when it uses the built-in statuses), which still finds the set after the
 * unit type is renamed, so it is matched first and the name second.
 */

interface UnitStatusSetLike {
  UnitType: string;
  StatusId?: string | number | null;
}

interface UnitStatusSetOwner {
  Type?: string | null;
  CustomStatusSetId?: string | number | null;
}

interface StatusOptionLike {
  Id: number | string;
  Text: string;
}

interface CurrentUnitStatusLike {
  /** Id of the current status option (StatusesResultData.Id); 0 / missing on older servers. */
  StateId?: number | string | null;
  /** The current status's text. */
  State?: string | null;
}

const toId = (value: number | string | null | undefined): string => (value == null ? '' : String(value).trim());

/**
 * The custom status set the unit uses: by its `CustomStatusSetId`, then by its unit type name. Null when it has none,
 * in which case the unit uses the built-in statuses (the UnitType '0' entry).
 */
export const findUnitStatusSet = <T extends UnitStatusSetLike>(unitStatuses: readonly T[] | null | undefined, unit: UnitStatusSetOwner | null | undefined): T | null => {
  if (!unitStatuses || !unit) {
    return null;
  }

  const setId = toId(unit.CustomStatusSetId);
  if (setId !== '' && setId !== '0') {
    const bySetId = unitStatuses.find((set) => toId(set.StatusId) === setId);
    if (bySetId) {
      return bySetId;
    }
  }

  if (!unit.Type) {
    return null;
  }

  return unitStatuses.find((set) => set.UnitType === unit.Type) ?? null;
};

/**
 * The option in a status set that is the unit's current status: the option whose `Id` is the status's `StateId`, then
 * (older servers, which send no StateId) the option with the status's text. A StateId of 0 is only trusted through the
 * text: 0 is a real built-in option id, but a unit with no status yet reports 0 as well.
 */
export const findCurrentUnitStatusOption = <T extends StatusOptionLike>(statuses: readonly T[] | null | undefined, current: CurrentUnitStatusLike | null | undefined): T | null => {
  if (!statuses || !current) {
    return null;
  }

  const stateId = toId(current.StateId);
  const byId = stateId !== '' && stateId !== '0' ? statuses.find((status) => toId(status.Id) === stateId) : undefined;

  return byId ?? statuses.find((status) => status.Text === current.State) ?? null;
};
