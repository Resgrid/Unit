import { getActivityLinkKind } from '@/lib/activity-link-kind';
import { StatusDestinationSources } from '@/models/v4/calls/statusDestinationSources';

describe('getActivityLinkKind', () => {
  it.each([
    [StatusDestinationSources.CarryForward, 'CarryForward'],
    [StatusDestinationSources.Dispatch, 'Dispatch'],
    [StatusDestinationSources.Unit, 'Unit'],
  ])('marks source %p (%s) as auto-linked', (source) => {
    expect(getActivityLinkKind(source)).toBe('auto');
  });

  it('marks the Inferred source as inferred', () => {
    expect(getActivityLinkKind(StatusDestinationSources.Inferred)).toBe('inferred');
  });

  it('shows nothing for an explicit link', () => {
    expect(getActivityLinkKind(StatusDestinationSources.Explicit)).toBeNull();
  });

  it.each([[null], [undefined], ['']])('shows nothing without a source (%p)', (source) => {
    expect(getActivityLinkKind(source)).toBeNull();
  });

  it.each([[0], [6], [-1], [Number.NaN], ['abc']])('shows nothing for an unknown source (%p)', (source) => {
    expect(getActivityLinkKind(source)).toBeNull();
  });

  it('accepts string-typed values from the API', () => {
    expect(getActivityLinkKind('3')).toBe('auto');
    expect(getActivityLinkKind('5')).toBe('inferred');
    expect(getActivityLinkKind('1')).toBeNull();
  });
});
