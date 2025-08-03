import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { StatusBottomSheet } from '../status-bottom-sheet';

// Mock the UI components
jest.mock('../../ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen }: any) => (isOpen ? children : null),
  ActionsheetBackdrop: ({ children }: any) => children,
  ActionsheetContent: ({ children }: any) => children,
  ActionsheetDragIndicator: () => null,
  ActionsheetDragIndicatorWrapper: ({ children }: any) => children,
}));

jest.mock('../../ui/button', () => {
  const { Text, Pressable } = require('react-native');
  return {
    Button: ({ children, onPress }: any) => <Pressable onPress={onPress}>{children}</Pressable>,
    ButtonText: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('../../ui/checkbox', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Checkbox: ({ children, value, isChecked, onChange }: any) => (
      <Pressable accessibilityRole="checkbox" onPress={() => onChange?.(!isChecked)}>
        {children}
      </Pressable>
    ),
    CheckboxIcon: () => null,
    CheckboxIndicator: ({ children }: any) => <View>{children}</View>,
    CheckboxLabel: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('../../ui/heading', () => {
  const { Text } = require('react-native');
  return {
    Heading: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('../../ui/text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('../../ui/textarea', () => {
  const { TextInput, View } = require('react-native');
  return {
    Textarea: ({ children }: any) => <View>{children}</View>,
    TextareaInput: ({ placeholder, value, onChangeText }: any) => (
      <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} />
    ),
  };
});

jest.mock('../../ui/vstack', () => {
  const { View } = require('react-native');
  return {
    VStack: ({ children }: any) => <View>{children}</View>,
  };
});

// Mock the stores
const mockStatusBottomSheetStore = {
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
};

const mockCoreStore = {
  activeCall: null,
};

const mockCallsStore = {
  calls: [
    {
      CallId: '1',
      Number: 'CALL001',
      Name: 'Test Emergency Call',
      Address: '123 Test Street',
    },
  ],
};

const mockStatusesStore = {
  getState: () => ({
    saveUnitStatus: jest.fn().mockResolvedValue(undefined),
  }),
};

jest.mock('@/stores/status/store', () => ({
  useStatusBottomSheetStore: () => mockStatusBottomSheetStore,
  useStatusesStore: mockStatusesStore,
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: () => mockCoreStore,
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: () => mockCallsStore,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'Set Status: {{status}}' && options?.status) {
        return `Set Status: ${options.status}`;
      }
      if (key === 'calls.no_call_selected') {
        return 'No call selected';
      }
      if (key === 'Select a Call') {
        return 'Select a Call';
      }
      if (key === 'Next') {
        return 'Next';
      }
      return key;
    },
  }),
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  CheckIcon: () => null,
  CircleIcon: () => null,
}));

describe('StatusBottomSheet', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<StatusBottomSheet />);
    expect(getByText('Set Status: Responding')).toBeTruthy();
  });

  it('displays call selection options', () => {
    const { getByText } = render(<StatusBottomSheet />);

    // Should have call options - the text is split, so we need to search for the patterns
    expect(getByText(/CALL001/)).toBeTruthy();
    expect(getByText(/Test Emergency Call/)).toBeTruthy();
    expect(getByText('123 Test Street')).toBeTruthy();
  });

  it('shows next button', () => {
    const { getByText } = render(<StatusBottomSheet />);
    expect(getByText('Next')).toBeTruthy();
  });
});
