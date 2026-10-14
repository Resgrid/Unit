import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { type RecordSummaryData, RmsRecordState } from '@/models/v4/records';
import { terminologyStore } from '@/stores/terminology/store';

import { RecordListItem } from '../record-list-item';

let mockCatalogNames: Record<string, string> = {};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => ({ AlertTriangle: 'AlertTriangle', CloudOff: 'CloudOff', FileText: 'FileText' }));

jest.mock('@/api/config/terminology', () => ({
  getTerminology: jest.fn(),
}));

jest.mock('@/stores/records/store', () => ({
  useRecordsStore: (selector: (state: unknown) => unknown) =>
    selector({ entryFor: (definitionKey: string) => (mockCatalogNames[definitionKey] ? { DefinitionKey: definitionKey, Name: mockCatalogNames[definitionKey] } : null) }),
}));

jest.mock('@/components/ui/badge', () => {
  const { Text, View } = require('react-native');
  return {
    Badge: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    BadgeText: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@/components/ui/hstack', () => {
  const { View } = require('react-native');
  return { HStack: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@/components/ui/pressable', () => {
  const { Pressable } = require('react-native');
  return { Pressable };
});

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

const summary = (overrides: Partial<RecordSummaryData>): RecordSummaryData => ({
  RecordId: 'r1',
  DefinitionKey: 'system.run',
  DefinitionVersion: 1,
  State: RmsRecordState.Draft,
  CreatedOn: '2026-10-13T00:00:00Z',
  ModifiedOn: '2026-10-13T00:00:00Z',
  RowVersion: 1,
  ...overrides,
});

describe('RecordListItem record type', () => {
  beforeEach(() => {
    mockCatalogNames = {};
    terminologyStore.setState({ names: {}, isLoaded: true, error: null, identityKey: null });
  });

  it('shows the department name for a built-in type instead of its raw key', () => {
    mockCatalogNames = { 'system.run': 'Run' };
    terminologyStore.setState({ names: { 'record-type.run': 'Incident' } });

    const { unmount } = render(<RecordListItem record={summary({})} onPress={jest.fn()} />);

    expect(screen.getAllByText('Incident').length).toBeGreaterThan(0);
    expect(screen.queryByText('system.run')).toBeNull();
    unmount();
  });

  it('shows the department name on a record number row as its subtitle', () => {
    terminologyStore.setState({ names: { 'record-type.run': 'Incident' } });

    const { unmount } = render(<RecordListItem record={summary({ RecordNumber: 'R-12' })} onPress={jest.fn()} />);

    expect(screen.getByText('R-12')).toBeTruthy();
    expect(screen.getByText('Incident')).toBeTruthy();
    unmount();
  });

  it('falls back to the catalog name when the type is not renamed', () => {
    mockCatalogNames = { 'system.run': 'Run' };

    const { unmount } = render(<RecordListItem record={summary({})} onPress={jest.fn()} />);

    expect(screen.getAllByText('Run').length).toBeGreaterThan(0);
    expect(screen.queryByText('system.run')).toBeNull();
    unmount();
  });

  it('names a legacy record by its record type number', () => {
    terminologyStore.setState({ names: { 'record-type.training': 'Drill' } });

    const { unmount } = render(<RecordListItem record={summary({ DefinitionKey: null, RecordType: 2, RecordNumber: 'T-3' })} onPress={jest.fn()} />);

    expect(screen.getByText('Drill')).toBeTruthy();
    unmount();
  });
});
