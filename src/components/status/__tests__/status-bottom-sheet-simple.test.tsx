import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { StatusBottomSheet } from '../status-bottom-sheet';

// Mock nativewind
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

// Mock UI components
jest.mock('@/components/ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen }: any) => {
    const { View } = require('react-native');
    return isOpen ? <View testID="actionsheet">{children}</View> : null;
  },
  ActionsheetBackdrop: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-backdrop" {...props}>{children}</View>;
  },
  ActionsheetContent: ({ children, className, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-content" className={className} {...props}>{children}</View>;
  },
  ActionsheetDragIndicator: ({ ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator" {...props} />;
  },
  ActionsheetDragIndicatorWrapper: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator-wrapper" {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, testID, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity onPress={onPress} testID={testID} {...props}>{children}</TouchableOpacity>;
  },
  ButtonText: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ children, value, isChecked, onChange, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity
        testID={`checkbox-${value}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked }}
        onPress={() => onChange?.(true)}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  },
  CheckboxIcon: ({ as: Component, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="checkbox-icon" {...props} />;
  },
  CheckboxIndicator: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="checkbox-indicator" {...props}>{children}</View>;
  },
  CheckboxLabel: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="checkbox-label" {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText {...props}>{children}</RNText>;
  },
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  TextareaInput: ({ value, onChangeText, placeholder, ...props }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} {...props} />;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

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
      if (key === 'calls.no_call_selected') {
        return 'No Active Call';
      }
      if (key === 'Next') {
        return 'Next';
      }
      if (key === 'Select a Call') {
        return 'Select a Call';
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
  test('renders without crashing', () => {
    render(<StatusBottomSheet />);
    expect(screen.getByText('Set Status: Responding')).toBeTruthy();
  });

  test('displays call selection options', () => {
    render(<StatusBottomSheet />);

    // Should have call options
    expect(screen.getByText('CALL001 - Test Emergency Call')).toBeTruthy();
    expect(screen.getByText('123 Test Street')).toBeTruthy();
  });

  test('shows next button', () => {
    render(<StatusBottomSheet />);
    expect(screen.getByText('Next')).toBeTruthy();
  });

  test('handles checkbox selection', async () => {
    render(<StatusBottomSheet />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    if (checkboxes.length > 0) {
      fireEvent.press(checkboxes[0]);
    }
  });
});
