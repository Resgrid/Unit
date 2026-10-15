import { renderHook } from '@testing-library/react-native';

import { terminologyStore } from '@/stores/terminology/store';

import { recordTypeName, useRecordTypeName } from '../use-record-type-name';

let mockCatalogNames: Record<string, string> = {};

jest.mock('@/api/config/terminology', () => ({
  getTerminology: jest.fn(),
}));

jest.mock('@/stores/records/store', () => ({
  useRecordsStore: (selector: (state: unknown) => unknown) =>
    selector({ entryFor: (definitionKey: string) => (mockCatalogNames[definitionKey] ? { DefinitionKey: definitionKey, Name: mockCatalogNames[definitionKey] } : null) }),
}));

const names = { 'record-type.run': 'Incident', 'record-type.work': 'Shift On Duty' };

describe('recordTypeName', () => {
  it("uses the department's name for a built-in definition", () => {
    expect(recordTypeName(names, 'system.run', 1, 'Run')).toBe('Incident');
  });

  it('falls back to the record type number when a legacy record carries no definition key', () => {
    expect(recordTypeName(names, null, 4, 'Work')).toBe('Shift On Duty');
    expect(recordTypeName(names, undefined, 1, 'Run')).toBe('Incident');
  });

  it("never gives a department definition a built-in type's name, even when it carries a type number", () => {
    expect(recordTypeName(names, 'dept.public-education', 1, 'Public Education')).toBe('Public Education');
  });

  it("falls back to the catalog's name when nothing was renamed", () => {
    expect(recordTypeName({}, 'system.run', 1, 'Run')).toBe('Run');
    expect(recordTypeName(names, null, null, 'Unknown')).toBe('Unknown');
  });
});

describe('useRecordTypeName', () => {
  beforeEach(() => {
    mockCatalogNames = { 'dept.public-education': 'Public Education', 'system.run': 'Run' };
    terminologyStore.setState({ names });
  });

  afterEach(() => {
    terminologyStore.setState({ names: {} });
  });

  it("uses the department's name for a built-in definition", () => {
    const { result, unmount } = renderHook(() => useRecordTypeName('system.run', 1));
    expect(result.current).toBe('Incident');
    unmount();
  });

  it("keeps a department definition's catalog name when it carries a type number", () => {
    const { result, unmount } = renderHook(() => useRecordTypeName('dept.public-education', 1));
    expect(result.current).toBe('Public Education');
    unmount();
  });

  it('uses the record type number for a legacy record', () => {
    const { result, unmount } = renderHook(() => useRecordTypeName(null, 4));
    expect(result.current).toBe('Shift On Duty');
    unmount();
  });

  it('is null when neither name is known', () => {
    const { result, unmount } = renderHook(() => useRecordTypeName('dept.unknown', null));
    expect(result.current).toBeNull();
    unmount();
  });
});
