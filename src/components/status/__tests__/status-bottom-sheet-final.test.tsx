import React from 'react';
import { render } from '@testing-library/react-native';

import { StatusBottomSheet } from '../status-bottom-sheet';

// Mock the stores
jest.mock('@/stores/status/store', () => ({
  useStatusBottomSheetStore: () => ({
    isOpen: true,
    currentStep: 'select-call' as const,
    selectedCall: null,
    selectedStatus: { Id: 1, Text: 'Responding' },
    note: '',
    setIsOpen: jest.fn(),
    setCurrentStep: jest.fn(),
    setSelectedCall: jest.fn(),
    setNote: jest.fn(),
    reset: jest.fn(),
  }),
  useStatusesStore: {
    getState: () => ({
      saveUnitStatus: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: () => ({
    activeCall: null,
  }),
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: () => ({
    calls: [
      {
        CallId: '1',
        Number: 'CALL001',
        Name: 'Test Emergency Call',
        Address: '123 Test Street',
      },
    ],
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'Set Status: {{status}}' && options?.status) {
        return `Set Status: ${options.status}`;
      }
      return key;
    },
  }),
}));

jest.mock('lucide-react-native', () => ({
  CheckIcon: () => null,
  CircleIcon: () => null,
}));

describe('StatusBottomSheet', () => {
  test('renders without error', () => {
    expect(() => render(<StatusBottomSheet />)).not.toThrow();
  });

  test('component mounts successfully', () => {
    const component = render(<StatusBottomSheet />);
    expect(component).toBeDefined();
  });
});
