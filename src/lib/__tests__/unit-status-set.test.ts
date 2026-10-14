import { findCurrentUnitStatusOption, findUnitStatusSet } from '@/lib/unit-status-set';

describe('unit status set', () => {
  const builtIn = { UnitType: '0', StatusId: '', Statuses: [] };
  const engineSet = { UnitType: 'Engine', StatusId: '12', Statuses: [] };
  const ladderSet = { UnitType: 'Ladder', StatusId: '15', Statuses: [] };
  const unitStatuses = [builtIn, engineSet, ladderSet];

  describe('findUnitStatusSet', () => {
    it('finds the set by the unit custom status set id, so a renamed unit type still resolves', () => {
      expect(findUnitStatusSet(unitStatuses, { Type: 'Engine (renamed)', CustomStatusSetId: '12' })).toBe(engineSet);
      expect(findUnitStatusSet(unitStatuses, { Type: 'Engine', CustomStatusSetId: 15 })).toBe(ladderSet);
    });

    it('falls back to the unit type name when no set id is sent (older servers) or it is the built-in 0', () => {
      expect(findUnitStatusSet(unitStatuses, { Type: 'Engine' })).toBe(engineSet);
      expect(findUnitStatusSet(unitStatuses, { Type: 'Engine', CustomStatusSetId: '' })).toBe(engineSet);
      expect(findUnitStatusSet(unitStatuses, { Type: 'Engine', CustomStatusSetId: '0' })).toBe(engineSet);
      expect(findUnitStatusSet(unitStatuses, { Type: 'Engine', CustomStatusSetId: null })).toBe(engineSet);
    });

    it('falls back to the unit type name when the set id matches no listed set', () => {
      expect(findUnitStatusSet(unitStatuses, { Type: 'Ladder', CustomStatusSetId: '99' })).toBe(ladderSet);
    });

    it('returns null when the unit has no custom set, leaving the built-in statuses to the caller', () => {
      expect(findUnitStatusSet(unitStatuses, { Type: 'Tanker', CustomStatusSetId: '0' })).toBeNull();
      expect(findUnitStatusSet(unitStatuses, { Type: '', CustomStatusSetId: '' })).toBeNull();
      expect(findUnitStatusSet(unitStatuses, { Type: null })).toBeNull();
      expect(findUnitStatusSet(null, { Type: 'Engine' })).toBeNull();
      expect(findUnitStatusSet(unitStatuses, null)).toBeNull();
    });
  });

  describe('findCurrentUnitStatusOption', () => {
    const statuses = [
      { Id: 0, Text: 'Available' },
      { Id: 3, Text: 'Committed' },
      { Id: 7, Text: 'Responding' },
    ];

    it('matches the option by the status option id, even when its text has changed', () => {
      expect(findCurrentUnitStatusOption(statuses, { StateId: 7, State: 'En Route' })).toBe(statuses[2]);
      expect(findCurrentUnitStatusOption(statuses, { StateId: '3', State: 'Committed' })).toBe(statuses[1]);
    });

    it('matches on the status text when no option id is sent (older servers)', () => {
      expect(findCurrentUnitStatusOption(statuses, { State: 'Responding' })).toBe(statuses[2]);
      expect(findCurrentUnitStatusOption(statuses, { StateId: null, State: 'Committed' })).toBe(statuses[1]);
    });

    it('only trusts a 0 id through the text, since a unit with no status reports 0 too', () => {
      expect(findCurrentUnitStatusOption(statuses, { StateId: 0, State: 'Available' })).toBe(statuses[0]);
      expect(findCurrentUnitStatusOption(statuses, { StateId: 0, State: 'Unknown' })).toBeNull();
    });

    it('falls back to the text when the id is not in the set, and returns null when nothing matches', () => {
      expect(findCurrentUnitStatusOption(statuses, { StateId: 42, State: 'Committed' })).toBe(statuses[1]);
      expect(findCurrentUnitStatusOption(statuses, { StateId: 42, State: 'Out of Service' })).toBeNull();
      expect(findCurrentUnitStatusOption(null, { State: 'Available' })).toBeNull();
      expect(findCurrentUnitStatusOption(statuses, null)).toBeNull();
    });
  });
});
