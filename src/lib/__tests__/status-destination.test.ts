import { getUnitStatusCallDestinationId, resolveDefaultStatusCall } from '@/lib/status-destination';
import { type CallResultData } from '@/models/v4/calls/callResultData';

const call = (CallId: string): CallResultData => ({ CallId, Number: `C${CallId}`, Name: `Call ${CallId}` }) as CallResultData;

describe('getUnitStatusCallDestinationId', () => {
  it('returns the id of a call destination', () => {
    expect(getUnitStatusCallDestinationId({ UnitId: 'unit-1', DestinationId: 555, DestinationType: 2 }, 'unit-1')).toBe('555');
  });

  it('accepts string-typed values from the API', () => {
    expect(getUnitStatusCallDestinationId({ UnitId: '1', DestinationId: '555', DestinationType: '2' }, '1')).toBe('555');
  });

  it.each([[null], [undefined], [''], [0]])('treats a legacy untyped destination (%p) as a call', (DestinationType) => {
    expect(getUnitStatusCallDestinationId({ UnitId: 'unit-1', DestinationId: 555, DestinationType }, 'unit-1')).toBe('555');
  });

  it.each([[1], [3], ['1']])('ignores station and POI destinations (type %p)', (DestinationType) => {
    expect(getUnitStatusCallDestinationId({ UnitId: 'unit-1', DestinationId: 555, DestinationType }, 'unit-1')).toBeNull();
  });

  it.each([[null], [undefined], [0], ['0'], ['']])('returns null when the status has no destination (%p)', (DestinationId) => {
    expect(getUnitStatusCallDestinationId({ UnitId: 'unit-1', DestinationId, DestinationType: 2 }, 'unit-1')).toBeNull();
  });

  it('never borrows the destination of a different unit', () => {
    expect(getUnitStatusCallDestinationId({ UnitId: 'unit-2', DestinationId: 555, DestinationType: 2 }, 'unit-1')).toBeNull();
  });

  it('returns null without a unit status', () => {
    expect(getUnitStatusCallDestinationId(null, 'unit-1')).toBeNull();
  });
});

describe('resolveDefaultStatusCall', () => {
  const unitStatus = { UnitId: 'unit-1', DestinationId: 555, DestinationType: 2 };

  it('prefers the active call when it is open', () => {
    expect(resolveDefaultStatusCall({ availableCalls: [call('555'), call('777')], activeCallId: '777', unitStatus, unitId: 'unit-1' })?.CallId).toBe('777');
  });

  it("falls back to the unit's latest status call when the active call is closed", () => {
    expect(resolveDefaultStatusCall({ availableCalls: [call('555')], activeCallId: '777', unitStatus, unitId: 'unit-1' })?.CallId).toBe('555');
  });

  it("uses the unit's latest status call when no active call is set", () => {
    expect(resolveDefaultStatusCall({ availableCalls: [call('555')], activeCallId: null, unitStatus, unitId: 'unit-1' })?.CallId).toBe('555');
  });

  it('returns null when the call is no longer open', () => {
    expect(resolveDefaultStatusCall({ availableCalls: [call('777')], activeCallId: null, unitStatus, unitId: 'unit-1' })).toBeNull();
  });

  it('returns null when there is nothing to default to', () => {
    expect(resolveDefaultStatusCall({ availableCalls: [call('555')], activeCallId: null, unitStatus: null, unitId: 'unit-1' })).toBeNull();
  });
});
