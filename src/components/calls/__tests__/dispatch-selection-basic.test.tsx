import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { DispatchSelectionModal } from '../dispatch-selection-modal';

// Mock dependencies
jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: () => ({
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
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

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
    const { queryByText } = render(
      <DispatchSelectionModal {...mockProps} isVisible={false} />
    );

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