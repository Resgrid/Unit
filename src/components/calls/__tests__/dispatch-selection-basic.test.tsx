import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { DispatchSelectionModal } from '../dispatch-selection-modal';

// Mock dependencies
jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: (selector: any) =>
    typeof selector === 'function'
      ? selector({
          data: {
            users: [],
            groups: [],
            roles: [],
            units: [],
          },
          selection: {
            everyone: false,
            users: [],
            groups: [],
            roles: [],
            units: [],
          },
          isLoading: false,
          error: null,
          searchQuery: '',
          fetchDispatchData: jest.fn(),
          setSelection: jest.fn(),
          toggleEveryone: jest.fn(),
          toggleUser: jest.fn(),
          toggleGroup: jest.fn(),
          toggleRole: jest.fn(),
          toggleUnit: jest.fn(),
          setSearchQuery: jest.fn(),
          clearSelection: jest.fn(),
          getFilteredData: () => ({
            users: [],
            groups: [],
            roles: [],
            units: [],
          }),
        })
      : {
          data: {
            users: [],
            groups: [],
            roles: [],
            units: [],
          },
          selection: {
            everyone: false,
            users: [],
            groups: [],
            roles: [],
            units: [],
          },
          isLoading: false,
          error: null,
          searchQuery: '',
          fetchDispatchData: jest.fn(),
          setSelection: jest.fn(),
          toggleEveryone: jest.fn(),
          toggleUser: jest.fn(),
          toggleGroup: jest.fn(),
          toggleRole: jest.fn(),
          toggleUnit: jest.fn(),
          setSearchQuery: jest.fn(),
          clearSelection: jest.fn(),
          getFilteredData: () => ({
            users: [],
            groups: [],
            roles: [],
            units: [],
          }),
        },
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

// The modal is now a gluestack Actionsheet bottom sheet; render its parts as
// plain views so the sheet's content is reachable in the test tree.
jest.mock('@/components/ui/actionsheet', () => {
  const { View } = require('react-native');
  return {
    Actionsheet: ({ isOpen, children, testID }: any) => (isOpen ? <View testID={testID ?? 'actionsheet'}>{children}</View> : null),
    ActionsheetBackdrop: ({ children }: any) => <View testID="actionsheet-backdrop">{children}</View>,
    ActionsheetContent: ({ children, style }: any) => (
      <View testID="actionsheet-content" style={style}>
        {children}
      </View>
    ),
    ActionsheetDragIndicator: () => <View testID="actionsheet-drag-indicator" />,
    ActionsheetDragIndicatorWrapper: ({ children }: any) => <View testID="actionsheet-drag-indicator-wrapper">{children}</View>,
    // The recipient list is virtualized (FlashList); render every row so the
    // sheet's content stays reachable in the test tree.
    ActionsheetFlatList: ({ data, renderItem, keyExtractor, testID }: any) => (
      <View testID={testID}>
        {(data ?? []).map((item: any, index: number) => (
          <View key={keyExtractor ? keyExtractor(item, index) : index}>{renderItem({ item, index })}</View>
        ))}
      </View>
    ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DispatchSelectionModal', () => {
  const mockProps = {
    isVisible: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('should render when visible', () => {
    render(<DispatchSelectionModal {...mockProps} />);

    expect(screen.getByText('calls.select_dispatch_recipients')).toBeTruthy();
    expect(screen.getByText('calls.everyone')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(<DispatchSelectionModal {...mockProps} isVisible={false} />);

    expect(queryByText('calls.select_dispatch_recipients')).toBeNull();
  });

  it('should render search input', () => {
    render(<DispatchSelectionModal {...mockProps} />);

    expect(screen.getByPlaceholderText('common.search')).toBeTruthy();
  });

  it('should render confirm and cancel buttons', () => {
    render(<DispatchSelectionModal {...mockProps} />);

    expect(screen.getByText('common.confirm')).toBeTruthy();
    expect(screen.getByText('common.cancel')).toBeTruthy();
  });
});
