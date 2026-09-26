import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ServerUrlBottomSheet } from '../server-url-bottom-sheet';

const mockSetUrl = jest.fn().mockResolvedValue(undefined);
const mockGetUrl = jest.fn().mockResolvedValue('https://test.com/api/v4');
const mockGetSystemConfig = jest.fn();
const mockFormSetValue = jest.fn();
const mockFormSetError = jest.fn();
const mockOnUrlChanged = jest.fn().mockResolvedValue(undefined);
let mockFormValues: { url: string } = { url: 'https://test.com' };
let mockSelectOnValueChange: ((value: string) => void) | undefined;

const LOCATIONS = [
  { Name: 'US-West', ApiUrl: 'https://api.resgrid.com', DisplayName: 'Resgrid North America (Global)', LocationInfo: '', IsDefault: true, AllowsFreeAccounts: true },
  { Name: 'EU-Central', ApiUrl: 'https://api-eu-central.resgrid.com/api/v4', DisplayName: 'Resgrid Europe', LocationInfo: '', IsDefault: false, AllowsFreeAccounts: false },
];

jest.mock('@/api/config', () => ({
  getSystemConfig: () => mockGetSystemConfig(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.server_url': 'Server URL',
        'settings.server': 'Server',
        'settings.custom': 'Custom',
        'settings.enter_server_url': 'Enter Resgrid API URL',
        'settings.server_url_note': 'Note: This is the URL of the Resgrid API',
        'loading.loadingData': 'Loading data...',
        'form.required': 'This field is required',
        'form.invalid_url': 'Please enter a valid URL',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
  cssInterop: jest.fn(),
  styled: jest.fn((Component: any) => Component),
}));

jest.mock('lucide-react-native', () => ({ ChevronDownIcon: 'ChevronDownIcon' }));

jest.mock('react-hook-form', () => ({
  useForm: () => {
    const React = require('react');
    const [, forceRender] = React.useState(0);

    // react-hook-form's setValue is referentially stable; the component's
    // load effect depends on it, so the mock must be stable too.
    const setValue = React.useCallback((name: 'url', value: string) => {
      mockFormValues = { ...mockFormValues, [name]: value };
      mockFormSetValue(name, value);
      forceRender((current: number) => current + 1);
    }, []);

    return {
      control: {},
      handleSubmit: (fn: Function) => () => fn({ ...mockFormValues }),
      setValue,
      setError: mockFormSetError,
      formState: { errors: {} },
    };
  },
  Controller: ({ name, render }: any) =>
    render({
      field: {
        onChange: (value: string) => {
          mockFormValues = { ...mockFormValues, [name]: value };
        },
        value: mockFormValues[name as keyof typeof mockFormValues] ?? '',
      },
    }),
}));

jest.mock('@/stores/app/server-url-store', () => ({
  useServerUrlStore: (selector: (state: { getUrl: typeof mockGetUrl; setUrl: typeof mockSetUrl }) => unknown) => selector({ getUrl: mockGetUrl, setUrl: mockSetUrl }),
}));

jest.mock('@/lib/env', () => ({
  Env: { API_VERSION: 'v4' },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../ui/actionsheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Actionsheet: ({ children, isOpen }: any) => (isOpen ? React.createElement(View, { testID: 'actionsheet' }, children) : null),
    ActionsheetBackdrop: ({ children }: any) => React.createElement(View, {}, children),
    ActionsheetContent: ({ children }: any) => React.createElement(View, {}, children),
    ActionsheetDragIndicator: () => React.createElement(View, {}),
    ActionsheetDragIndicatorWrapper: ({ children }: any) => React.createElement(View, {}, children),
  };
});

jest.mock('../../ui/button', () => {
  const React = require('react');
  const { TouchableOpacity, Text, View } = require('react-native');
  return {
    Button: ({ children, onPress }: any) => React.createElement(TouchableOpacity, { onPress }, children),
    ButtonText: ({ children }: any) => React.createElement(Text, {}, children),
    ButtonSpinner: () => React.createElement(View, { testID: 'button-spinner' }),
  };
});

jest.mock('../../ui/form-control', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    FormControl: ({ children }: any) => React.createElement(View, {}, children),
    FormControlLabel: ({ children }: any) => React.createElement(View, {}, children),
    FormControlLabelText: ({ children }: any) => React.createElement(Text, {}, children),
    FormControlHelperText: ({ children }: any) => React.createElement(View, {}, children),
    FormControlError: ({ children }: any) => React.createElement(View, {}, children),
    FormControlErrorText: ({ children }: any) => React.createElement(Text, {}, children),
  };
});

jest.mock('../../ui/center', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Center: ({ children, testID }: any) => React.createElement(View, { testID }, children),
  };
});

jest.mock('../../ui/hstack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    HStack: ({ children }: any) => React.createElement(View, {}, children),
  };
});

jest.mock('../../ui/input', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');
  return {
    Input: ({ children }: any) => React.createElement(View, {}, children),
    InputField: (props: any) => React.createElement(TextInput, { testID: 'input-field', ...props }),
  };
});

jest.mock('../../ui/select', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    Select: ({ children, onValueChange }: any) => {
      mockSelectOnValueChange = onValueChange;
      return React.createElement(View, { testID: 'server-select' }, children);
    },
    SelectBackdrop: ({ children }: any) => React.createElement(View, {}, children),
    SelectContent: ({ children }: any) => React.createElement(View, {}, children),
    SelectDragIndicator: () => React.createElement(View, {}),
    SelectDragIndicatorWrapper: ({ children }: any) => React.createElement(View, {}, children),
    SelectIcon: () => React.createElement(View, {}),
    SelectInput: ({ value, placeholder }: any) => React.createElement(Text, { testID: 'select-input' }, value || placeholder),
    SelectItem: ({ label, value }: any) => React.createElement(TouchableOpacity, { testID: `select-item-${value}`, onPress: () => mockSelectOnValueChange?.(value) }, React.createElement(Text, {}, label)),
    SelectPortal: ({ children }: any) => React.createElement(View, {}, children),
    SelectTrigger: ({ children }: any) => React.createElement(View, {}, children),
  };
});

jest.mock('../../ui/text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Text: ({ children }: any) => React.createElement(Text, {}, children),
  };
});

jest.mock('../../ui/vstack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    VStack: ({ children }: any) => React.createElement(View, {}, children),
  };
});

describe('ServerUrlBottomSheet', () => {
  const mockOnClose = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onUrlChanged: mockOnUrlChanged,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUrl.mockResolvedValue('https://test.com/api/v4');
    mockGetSystemConfig.mockResolvedValue({ Data: { Locations: LOCATIONS } });
    mockFormValues = { url: 'https://test.com' };
    mockSelectOnValueChange = undefined;
  });

  describe('Rendering', () => {
    it('does not render when closed', () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('actionsheet')).toBeNull();
      expect(mockGetSystemConfig).not.toHaveBeenCalled();
      unmount();
    });

    it('shows a loading state while server options load', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      expect(screen.getByTestId('server-options-loading')).toBeTruthy();
      expect(screen.getByText('Loading data...')).toBeTruthy();

      await waitFor(() => {
        expect(screen.queryByTestId('server-options-loading')).toBeNull();
      });
      unmount();
    });

    it('lists each Resgrid location plus a custom option', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-item-US-West')).toBeTruthy();
      });

      expect(screen.getByTestId('select-item-EU-Central')).toBeTruthy();
      expect(screen.getByTestId('select-item-__custom__')).toBeTruthy();
      unmount();
    });
  });

  describe('Initial selection', () => {
    it('selects custom and shows the domain only when the url matches no location', async () => {
      mockGetUrl.mockResolvedValue('https://custom.resgrid.dev/api/v4/');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('Custom');
        expect(screen.getByTestId('input-field').props.value).toBe('https://custom.resgrid.dev');
      });

      expect(screen.getByTestId('input-field').props.editable).toBe(true);
      unmount();
    });

    it('selects the matching location and locks the url field', async () => {
      mockGetUrl.mockResolvedValue('https://api-eu-central.resgrid.com/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('EU-Central');
      });

      expect(screen.getByTestId('input-field').props.editable).toBe(false);
      unmount();
    });

    it('falls back to custom when the location list cannot be loaded', async () => {
      mockGetSystemConfig.mockRejectedValue(new Error('Network error'));
      mockGetUrl.mockResolvedValue('https://selfhosted.example.com/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('Custom');
      });

      expect(screen.queryByTestId('select-item-US-West')).toBeNull();
      expect(screen.getByTestId('input-field').props.value).toBe('https://selfhosted.example.com');
      unmount();
    });
  });

  describe('Unreadable stored url', () => {
    it('still opens the url field for editing when the stored url cannot be read', async () => {
      const { logger } = jest.requireMock('@/lib/logging');
      mockGetUrl.mockRejectedValue(new Error('Storage unavailable'));

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('server-options-loading')).toBeNull();
      });

      expect(screen.getByTestId('select-input').props.children).toBe('Custom');
      expect(screen.getByTestId('input-field').props.editable).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to read the current server URL' }));
      unmount();
    });
  });

  describe('Changing servers', () => {
    it('fills the url field with the selected location ApiUrl', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-item-US-West')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('select-item-US-West'));

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('US-West');
        expect(screen.getByTestId('input-field').props.value).toBe('https://api.resgrid.com');
      });

      expect(screen.getByTestId('input-field').props.editable).toBe(false);
      unmount();
    });

    it('re-enables the url field when custom is selected', async () => {
      mockGetUrl.mockResolvedValue('https://api.resgrid.com/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('US-West');
      });

      fireEvent.press(screen.getByTestId('select-item-__custom__'));

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('Custom');
      });

      expect(screen.getByTestId('input-field').props.editable).toBe(true);
      unmount();
    });
  });

  describe('Saving', () => {
    it('saves a custom url with the api suffix and reports the change', async () => {
      mockGetUrl.mockResolvedValue('https://api.resgrid.com/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('US-West');
      });

      fireEvent.press(screen.getByTestId('select-item-__custom__'));
      fireEvent.changeText(screen.getByTestId('input-field'), 'https://custom.example.com/');
      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockSetUrl).toHaveBeenCalledWith('https://custom.example.com/api/v4');
      });

      expect(mockOnUrlChanged).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalled();
      unmount();
    });

    it('saves the selected location ApiUrl without duplicating the api suffix', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-item-EU-Central')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('select-item-EU-Central'));
      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockSetUrl).toHaveBeenCalledWith('https://api-eu-central.resgrid.com/api/v4');
      });

      expect(mockOnUrlChanged).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('does not report a change when the same server is saved again', async () => {
      mockGetUrl.mockResolvedValue('https://api.resgrid.com/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('US-West');
      });

      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockSetUrl).toHaveBeenCalledWith('https://api.resgrid.com/api/v4');
      });

      expect(mockOnUrlChanged).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
      unmount();
    });

    it('shows an error and stays open when saving fails', async () => {
      mockSetUrl.mockRejectedValueOnce(new Error('Storage failure'));

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('server-options-loading')).toBeNull();
      });

      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockFormSetError).toHaveBeenCalledWith('root', { message: 'Storage failure' });
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnUrlChanged).not.toHaveBeenCalled();
      unmount();
    });
  });
});
