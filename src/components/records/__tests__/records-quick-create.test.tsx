import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type FieldRecordContextInput } from '@/models/v4/records';

import { RecordsQuickCreate } from '../records-quick-create';

const mockPush = jest.fn();
const mockSetContext = jest.fn();
const mockFetchCatalog = jest.fn().mockResolvedValue(null);
let mockFlagStatus = 'enabled';
let mockCatalog: { Definitions: { DefinitionKey: string }[] } | null = null;

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('lucide-react-native', () => ({ FilePlus2: 'FilePlus2' }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, testID }: { children: React.ReactNode; onPress: () => void; testID?: string }) => React.createElement(TouchableOpacity, { onPress, testID }, children),
    ButtonIcon: () => null,
    ButtonText: ({ children }: { children: React.ReactNode }) => React.createElement(Text, {}, children),
  };
});

jest.mock('@/stores/feature-flags/store', () => ({
  useRecordsFieldStatus: () => mockFlagStatus,
}));

jest.mock('@/stores/records/store', () => ({
  useRecordsStore: (selector: (state: unknown) => unknown) => selector({ setContext: mockSetContext, fetchCatalog: mockFetchCatalog, catalog: mockCatalog }),
}));

describe('RecordsQuickCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFlagStatus = 'enabled';
    mockCatalog = null;
  });

  it('fetches the catalog once while re-rendered with an equal but new context object', () => {
    const context = (): FieldRecordContextInput => ({ UnitId: 3, CallId: 42 });
    const { rerender, unmount } = render(<RecordsQuickCreate context={context()} />);

    rerender(<RecordsQuickCreate context={context()} />);
    rerender(<RecordsQuickCreate context={context()} />);

    expect(mockFetchCatalog).toHaveBeenCalledTimes(1);
    expect(mockSetContext).toHaveBeenCalledTimes(1);
    expect(mockSetContext).toHaveBeenCalledWith(expect.objectContaining({ UnitId: 3, CallId: 42 }));
    unmount();
  });

  it('fetches again when the context actually changes', () => {
    const { rerender, unmount } = render(<RecordsQuickCreate context={{ UnitId: 3, CallId: 42 }} />);

    rerender(<RecordsQuickCreate context={{ UnitId: 3, CallId: 43 }} />);

    expect(mockFetchCatalog).toHaveBeenCalledTimes(2);
    expect(mockSetContext).toHaveBeenLastCalledWith(expect.objectContaining({ UnitId: 3, CallId: 43 }));
    unmount();
  });

  it('does nothing and renders nothing while Field Records is not enabled', () => {
    mockFlagStatus = 'disabled';
    mockCatalog = { Definitions: [{ DefinitionKey: 'shift-log' }] };

    const { unmount } = render(<RecordsQuickCreate context={{ CallId: 42 }} />);

    expect(mockFetchCatalog).not.toHaveBeenCalled();
    expect(mockSetContext).not.toHaveBeenCalled();
    expect(screen.queryByTestId('records-quick-create')).toBeNull();
    unmount();
  });

  it('hides the button until the server offers a definition, then opens a new record', () => {
    const { rerender, unmount } = render(<RecordsQuickCreate context={{ CallId: 42 }} />);
    expect(screen.queryByTestId('records-quick-create')).toBeNull();

    mockCatalog = { Definitions: [{ DefinitionKey: 'shift-log' }] };
    rerender(<RecordsQuickCreate context={{ CallId: 42 }} />);
    fireEvent.press(screen.getByTestId('records-quick-create'));

    expect(mockPush).toHaveBeenCalledWith('/records/new');
    unmount();
  });
});
