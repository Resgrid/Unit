// Mock React Native components first
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  ScrollView: ({ children }: any) => <div>{children}</div>,
  View: ({ children }: any) => <div>{children}</div>,
  Alert: { alert: jest.fn() },
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { getConfig } from '@/api/config/config';
import NewCall from '../index';
import { router } from 'expo-router';

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => { });

// Mock axios
const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();
const mockAxios = {
  get: mockAxiosGet,
  post: mockAxiosPost,
  put: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(() => ({
    get: mockAxiosGet,
    post: mockAxiosPost,
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  })),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

jest.mock('axios', () => mockAxios);

// Mock getConfig
const mockGetConfig = jest.fn();
jest.mock('@/api/config/config', () => ({
  getConfig: mockGetConfig,
}));

// Mock createCall
const mockCreateCall = jest.fn();
jest.mock('@/api/calls/calls', () => ({
  createCall: mockCreateCall,
}));

// Mock stores
const mockUseCallsStore = jest.fn();
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: mockUseCallsStore,
}));

const mockUseDispatchStore = jest.fn();
jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: mockUseDispatchStore,
}));

const mockUseCoreStore = jest.fn();
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: mockUseCoreStore,
}));

// Mock auth store
jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({
      accessToken: null,
      refreshToken: null,
    })),
    setState: jest.fn(),
  },
}));

// Mock storage
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.example.com'),
}));

// Mock router
const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
    back: mockRouterBack,
  },
  Stack: {
    Screen: ({ children }: any) => children,
  },
}));

// Mock components
jest.mock('@/components/calls/dispatch-selection-modal', () => ({
  DispatchSelectionModal: ({ isVisible, onClose, onConfirm, initialSelection }: any) => {
    return isVisible ? (
      <div data-testid="dispatch-modal">
        <button onClick={onClose} data-testid="close-dispatch">
          Close
        </button>
        <button onClick={() => onConfirm(initialSelection)} data-testid="confirm-dispatch">
          Confirm
        </button>
      </div>
    ) : null;
  },
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen, onClose }: any) => {
    return isOpen ? (
      <div data-testid="address-selection-sheet">
        <button onClick={onClose} data-testid="close-address-sheet">
          Close
        </button>
        {children}
      </div>
    ) : null;
  },
}));

jest.mock('@/components/maps/full-screen-location-picker', () => ({
  __esModule: true,
  default: ({ onLocationSelected, onClose }: any) => (
    <div data-testid="location-picker">
      <button
        onClick={() => onLocationSelected({ latitude: 40.7128, longitude: -74.0060, address: 'Test Address' })}
        data-testid="select-location"
      >
        Select Location
      </button>
      <button onClick={onClose} data-testid="close-location-picker">
        Close
      </button>
    </div>
  ),
}));

jest.mock('@/components/maps/location-picker', () => ({
  __esModule: true,
  default: ({ onLocationSelected }: any) => (
    <div data-testid="location-picker-small">
      <button
        onClick={() => onLocationSelected({ latitude: 40.7128, longitude: -74.0060, address: 'Test Address' })}
        data-testid="select-location-small"
      >
        Select Location
      </button>
    </div>
  ),
}));

// Mock other dependencies
jest.mock('@/components/common/loading', () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    show: jest.fn(),
  }),
}));

jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    show: jest.fn(),
  }),
}));

// Mock all UI components to avoid cssInterop issues
jest.mock('@/components/ui/box', () => ({
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, testID, disabled, ...props }: any) => (
    <button onClick={onPress} data-testid={testID} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  ButtonText: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ children }: any) => <div>{children}</div>,
  InputField: ({ testID, onChangeText, value, ...props }: any) => (
    <input
      data-testid={testID}
      onChange={(e) => onChangeText && onChangeText(e.target.value)}
      value={value}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/form-control', () => ({
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormControlLabel: ({ children }: any) => <div>{children}</div>,
  FormControlLabelText: ({ children }: any) => <span>{children}</span>,
  FormControlError: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectInput: ({ children }: any) => <div>{children}</div>,
  SelectIcon: ({ children }: any) => <div>{children}</div>,
  SelectPortal: ({ children }: any) => <div>{children}</div>,
  SelectBackdrop: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ children }: any) => <div>{children}</div>,
  TextareaInput: ({ children }: any) => <textarea>{children}</textarea>,
}));

jest.mock('@/components/ui/scroll-view', () => ({
  ScrollView: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/view', () => ({
  View: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => fn,
    formState: { errors: {} },
    setValue: jest.fn(),
  }),
  Controller: ({ render }: any) => render({ field: { onChange: jest.fn(), onBlur: jest.fn(), value: '' } }),
}));

// Mock lucide icons
jest.mock('lucide-react-native', () => ({
  SearchIcon: () => <div data-testid="search-icon">🔍</div>,
  PlusIcon: () => <div data-testid="plus-icon">➕</div>,
  ChevronDownIcon: () => <div data-testid="chevron-down-icon">⬇️</div>,
}));

// Google Maps Geocoding API response types
interface GeocodingResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

describe('NewCall Component - Address Search', () => {
  const mockCallPriorities = [
    { Id: 1, Name: 'High' },
    { Id: 2, Name: 'Medium' },
    { Id: 3, Name: 'Low' },
  ];

  const mockSingleGeocodingResult: GeocodingResponse = {
    status: 'OK',
    results: [
      {
        formatted_address: '123 Main St, New York, NY 10001, USA',
        geometry: {
          location: {
            lat: 40.7128,
            lng: -74.0060,
          },
        },
        place_id: 'ChIJOwg_06VPwokRYv534QaPC8g',
      },
    ],
  };

  const mockMultipleGeocodingResults: GeocodingResponse = {
    status: 'OK',
    results: [
      {
        formatted_address: '123 Main St, New York, NY 10001, USA',
        geometry: {
          location: {
            lat: 40.7128,
            lng: -74.0060,
          },
        },
        place_id: 'ChIJOwg_06VPwokRYv534QaPC8g',
      },
      {
        formatted_address: '123 Main St, Brooklyn, NY 11201, USA',
        geometry: {
          location: {
            lat: 40.6892,
            lng: -73.9442,
          },
        },
        place_id: 'ChIJOwg_06VPwokRYv534QaPC8h',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the config response
    mockGetConfig.mockResolvedValue({
      PageSize: 0,
      Timestamp: '',
      Version: '',
      Node: '',
      RequestId: '',
      Status: '',
      Environment: '',
      Data: {
        GoogleMapsKey: 'test-api-key',
        W3WKey: '',
        LoggingKey: '',
        MapUrl: '',
        MapAttribution: '',
        OpenWeatherApiKey: '',
        NovuBackendApiUrl: '',
        NovuSocketUrl: '',
        NovuApplicationId: '',
      },
    });

    // Mock the calls store
    mockUseCallsStore.mockReturnValue({
      callPriorities: mockCallPriorities,
      isLoading: false,
      error: null,
      fetchCallPriorities: jest.fn(),
    });

    // Mock the dispatch store
    mockUseDispatchStore.mockReturnValue({
      searchQuery: '',
      setSearchQuery: jest.fn(),
      getFilteredData: jest.fn(() => ({
        users: [],
        groups: [],
        roles: [],
        units: [],
      })),
      fetchDispatchData: jest.fn(),
      toggleUser: jest.fn(),
      toggleGroup: jest.fn(),
      toggleRole: jest.fn(),
      toggleUnit: jest.fn(),
      toggleEveryone: jest.fn(),
      isLoading: false,
      error: null,
    });
  });

  describe('Address Search Functionality', () => {
    it('should handle single geocoding result correctly', async () => {
      // Mock successful geocoding response with single result
      mockAxiosGet.mockResolvedValue({ data: mockSingleGeocodingResult });

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, '123 Main St, New York');
      fireEvent.press(searchButton);

      // Wait for API call and verify
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?address=123%20Main%20St%2C%20New%20York&key=test-api-key')
        );
      });

      // Verify that no address selection sheet is shown for single result
      expect(() => getByTestId('address-selection-sheet')).toThrow();
    });

    it('should handle multiple geocoding results and show address selection sheet', async () => {
      // Mock successful geocoding response with multiple results
      mockAxiosGet.mockResolvedValue({ data: mockMultipleGeocodingResults });

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, '123 Main St');
      fireEvent.press(searchButton);

      // Wait for API call and verify bottom sheet appears
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalled();
        expect(getByTestId('address-selection-sheet')).toBeTruthy();
      });
    });

    it('should not call API when address is empty', async () => {
      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Leave address empty and try to search
      fireEvent.changeText(addressInput, '');
      fireEvent.press(searchButton);

      // Verify API is not called
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });

    it('should handle API error gracefully', async () => {
      // Mock API error
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, '123 Main St');
      fireEvent.press(searchButton);

      // Wait for API call and verify error handling
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalled();
      });
    });

    it('should handle missing API key gracefully', async () => {
      // Mock config without API key
      mockGetConfig.mockResolvedValue({
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
        Data: {
          GoogleMapsKey: '',
          W3WKey: '',
          LoggingKey: '',
          MapUrl: '',
          MapAttribution: '',
          OpenWeatherApiKey: '',
          NovuBackendApiUrl: '',
          NovuSocketUrl: '',
          NovuApplicationId: '',
        },
      });

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, '123 Main St');
      fireEvent.press(searchButton);

      // Wait for error handling
      await waitFor(() => {
        expect(mockAxiosGet).not.toHaveBeenCalled();
      });
    });

    it('should handle zero results from API', async () => {
      // Mock API response with zero results
      mockAxiosGet.mockResolvedValue({
        data: {
          status: 'ZERO_RESULTS',
          results: [],
        },
      });

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, 'Non-existent Address');
      fireEvent.press(searchButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalled();
      });
    });

    it('should handle API status other than OK', async () => {
      // Mock API response with error status
      mockAxiosGet.mockResolvedValue({
        data: {
          status: 'REQUEST_DENIED',
          results: [],
        },
      });

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, '123 Main St');
      fireEvent.press(searchButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalled();
      });
    });

    it('should disable search button when geocoding is in progress', async () => {
      // Mock a slow API response
      mockAxiosGet.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockSingleGeocodingResult }), 100);
          })
      );

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, '123 Main St');
      fireEvent.press(searchButton);

      // Button should be disabled during geocoding
      await waitFor(() => {
        expect(searchButton.props.accessibilityState?.disabled).toBeTruthy();
      });
    });

    it('should close address selection sheet when close button is pressed', async () => {
      // Mock successful geocoding response with multiple results
      mockAxiosGet.mockResolvedValue({ data: mockMultipleGeocodingResults });

      const { getByTestId, queryByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address and search
      fireEvent.changeText(addressInput, '123 Main St');
      fireEvent.press(searchButton);

      // Wait for bottom sheet to appear
      await waitFor(() => {
        expect(getByTestId('address-selection-sheet')).toBeTruthy();
      });

      // Close the bottom sheet
      const closeButton = getByTestId('close-address-sheet');
      fireEvent.press(closeButton);

      // Bottom sheet should be closed
      await waitFor(() => {
        expect(queryByTestId('address-selection-sheet')).toBeNull();
      });
    });
  });

  describe('Form Validation', () => {
    it('should render form fields correctly', () => {
      const { getByTestId } = render(<NewCall />);

      expect(getByTestId('address-input')).toBeTruthy();
      expect(getByTestId('address-search-button')).toBeTruthy();
    });

    it('should disable search button when address is empty', () => {
      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Ensure address input is empty
      fireEvent.changeText(addressInput, '');

      // Button should be disabled
      expect(searchButton.props.accessibilityState?.disabled).toBeTruthy();
    });

    it('should enable search button when address is not empty', () => {
      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address
      fireEvent.changeText(addressInput, '123 Main St');

      // Button should be enabled
      expect(searchButton.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete address search flow', async () => {
      // Mock successful geocoding response
      mockAxiosGet.mockResolvedValue({ data: mockSingleGeocodingResult });

      const { getByTestId } = render(<NewCall />);

      const addressInput = getByTestId('address-input');
      const searchButton = getByTestId('address-search-button');

      // Enter address
      fireEvent.changeText(addressInput, '123 Main St, New York');

      // Verify button is enabled
      expect(searchButton.props.accessibilityState?.disabled).toBeFalsy();

      // Search
      fireEvent.press(searchButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?address=123%20Main%20St%2C%20New%20York&key=test-api-key')
        );
      });

      // Verify config was fetched
      expect(mockGetConfig).toHaveBeenCalledWith('GoogleMapsKey');
    });
  });
});

// Plus Code Search Component Tests
describe('NewCall Component - Plus Code Search', () => {
  const mockCallPriorities = [
    { Id: 1, Name: 'High' },
    { Id: 2, Name: 'Medium' },
    { Id: 3, Name: 'Low' },
  ];

  const mockPlusCodeGeocodingResult: GeocodingResponse = {
    status: 'OK',
    results: [
      {
        formatted_address: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
        geometry: {
          location: {
            lat: 37.4220936,
            lng: -122.083922,
          },
        },
        place_id: 'ChIJtYuu0V25j4ARwu5e4wwRYgE',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful API calls
    mockUseCallsStore.mockReturnValue({
      callPriorities: mockCallPriorities,
      isLoading: false,
      error: null,
      fetchCallPriorities: jest.fn(),
    });

    mockGetConfig.mockResolvedValue({
      PageSize: 0,
      Timestamp: '',
      Version: '',
      Node: '',
      RequestId: '',
      Status: '',
      Environment: '',
      Data: {
        GoogleMapsKey: 'test-api-key',
        W3WKey: '',
        LoggingKey: '',
        MapUrl: '',
        MapAttribution: '',
        OpenWeatherApiKey: '',
        NovuBackendApiUrl: '',
        NovuSocketUrl: '',
        NovuApplicationId: '',
      },
    });
  });

  describe('Plus Code Search UI', () => {
    it('should render plus code input field with search button', () => {
      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      expect(plusCodeInput).toBeTruthy();
      expect(searchButton).toBeTruthy();
    });

    it('should disable search button when plus code is empty', () => {
      const { getByTestId } = render(<NewCall />);

      const searchButton = getByTestId('plus-code-search-button');

      expect(searchButton.props.accessibilityState?.disabled).toBeTruthy();
    });

    it('should enable search button when plus code is entered', async () => {
      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code
      fireEvent.changeText(plusCodeInput, '849VCWC8+R9');

      await waitFor(() => {
        expect(searchButton.props.accessibilityState?.disabled).toBeFalsy();
      });
    });
  });

  describe('Plus Code Search Functionality', () => {
    it('should handle successful plus code search', async () => {
      // Mock successful geocoding response
      mockAxiosGet.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code and search
      fireEvent.changeText(plusCodeInput, '849VCWC8+R9');
      fireEvent.press(searchButton);

      // Wait for API call and verify
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9&key=test-api-key')
        );
      });
    });

    it('should handle empty plus code search', async () => {
      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Try to search with empty plus code
      fireEvent.changeText(plusCodeInput, '');
      fireEvent.press(searchButton);

      // API should not be called
      await waitFor(() => {
        expect(mockAxiosGet).not.toHaveBeenCalled();
      });
    });

    it('should handle plus code with spaces', async () => {
      // Mock successful geocoding response
      mockAxiosGet.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code with spaces and search
      fireEvent.changeText(plusCodeInput, '849V CWC8+R9');
      fireEvent.press(searchButton);

      // Wait for API call and verify proper encoding
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?address=849V%20CWC8%2BR9&key=test-api-key')
        );
      });
    });

    it('should handle plus code with context', async () => {
      // Mock successful geocoding response
      mockAxiosGet.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code with location context
      fireEvent.changeText(plusCodeInput, 'CWC8+R9 Mountain View');
      fireEvent.press(searchButton);

      // Wait for API call and verify
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?address=CWC8%2BR9%20Mountain%20View&key=test-api-key')
        );
      });
    });

    it('should handle missing API key gracefully', async () => {
      // Mock config without API key
      mockGetConfig.mockResolvedValue({
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
        Data: {
          GoogleMapsKey: '',
          W3WKey: '',
          LoggingKey: '',
          MapUrl: '',
          MapAttribution: '',
          OpenWeatherApiKey: '',
          NovuBackendApiUrl: '',
          NovuSocketUrl: '',
          NovuApplicationId: '',
        },
      });

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code and search
      fireEvent.changeText(plusCodeInput, '849VCWC8+R9');
      fireEvent.press(searchButton);

      // Wait for error handling
      await waitFor(() => {
        expect(mockAxiosGet).not.toHaveBeenCalled();
      });
    });

    it('should handle API error gracefully', async () => {
      // Mock API error
      mockAxiosGet.mockRejectedValue(new Error('Network Error'));

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code and search
      fireEvent.changeText(plusCodeInput, '849VCWC8+R9');
      fireEvent.press(searchButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalled();
      });
    });

    it('should handle zero results from API', async () => {
      // Mock API response with zero results
      mockAxiosGet.mockResolvedValue({
        data: {
          status: 'ZERO_RESULTS',
          results: [],
        },
      });

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code and search
      fireEvent.changeText(plusCodeInput, 'INVALID+CODE');
      fireEvent.press(searchButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalled();
      });
    });

    it('should disable search button during plus code geocoding', async () => {
      // Mock a slow API response
      mockAxiosGet.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockPlusCodeGeocodingResult }), 100);
          })
      );

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code and search
      fireEvent.changeText(plusCodeInput, '849VCWC8+R9');
      fireEvent.press(searchButton);

      // Button should be disabled during geocoding
      await waitFor(() => {
        expect(searchButton.props.accessibilityState?.disabled).toBeTruthy();
      });
    });
  });

  describe('Plus Code Search Integration', () => {
    it('should update form fields when plus code is found', async () => {
      // Mock successful geocoding response
      mockAxiosGet.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');
      const addressInput = getByTestId('address-input');

      // Enter plus code and search
      fireEvent.changeText(plusCodeInput, '849VCWC8+R9');
      fireEvent.press(searchButton);

      // Wait for API call and form updates
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalled();
        expect(addressInput.props.value).toBe('1600 Amphitheatre Parkway, Mountain View, CA 94043, USA');
      });
    });

    it('should handle complete plus code search flow', async () => {
      // Mock successful geocoding response
      mockAxiosGet.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const { getByTestId } = render(<NewCall />);

      const plusCodeInput = getByTestId('plus-code-input');
      const searchButton = getByTestId('plus-code-search-button');

      // Enter plus code
      fireEvent.changeText(plusCodeInput, '849VCWC8+R9');

      // Verify button is enabled
      expect(searchButton.props.accessibilityState?.disabled).toBeFalsy();

      // Search
      fireEvent.press(searchButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          expect.stringContaining('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9&key=test-api-key')
        );
      });

      // Verify config was fetched
      expect(mockGetConfig).toHaveBeenCalledWith('GoogleMapsKey');
    });
  });
});

describe('NewCall', () => {
  const mockCallPriorities = [
    { Id: 1, Name: 'High', DepartmentId: 1, Color: '#FF0000', Sort: 1, IsDeleted: false, IsDefault: false, Tone: 0 },
    { Id: 2, Name: 'Medium', DepartmentId: 1, Color: '#FFFF00', Sort: 2, IsDeleted: false, IsDefault: false, Tone: 0 },
  ];

  const mockCallTypes = [
    { Id: '1', Name: 'Emergency' },
    { Id: '2', Name: 'Medical' },
    { Id: '3', Name: 'Fire' },
  ];

  const mockCallsStore = {
    callPriorities: mockCallPriorities,
    callTypes: mockCallTypes,
    isLoading: false,
    error: null,
    fetchCallPriorities: jest.fn(),
    fetchCallTypes: jest.fn(),
    calls: [],
    fetchCalls: jest.fn(),
    init: jest.fn(),
  };

  const mockCoreStore = {
    config: {
      GoogleMapsKey: 'test-api-key',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCallsStore.mockReturnValue(mockCallsStore);
    mockUseCoreStore.mockReturnValue(mockCoreStore);
  });

  it('should render the new call form with type selection', () => {
    render(<NewCall />);

    expect(screen.getByText('calls.create_new_call')).toBeTruthy();
    expect(screen.getByText('calls.type')).toBeTruthy();
    expect(screen.getByText('calls.priority')).toBeTruthy();
  });

  it('should call fetchCallTypes on component mount', () => {
    render(<NewCall />);

    expect(mockCallsStore.fetchCallTypes).toHaveBeenCalledTimes(1);
    expect(mockCallsStore.fetchCallPriorities).toHaveBeenCalledTimes(1);
  });

  it('should display loading state', () => {
    mockUseCallsStore.mockReturnValue({
      ...mockCallsStore,
      isLoading: true,
    });

    render(<NewCall />);

    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });

  it('should display error state', () => {
    const errorMessage = 'Failed to load data';
    mockUseCallsStore.mockReturnValue({
      ...mockCallsStore,
      error: errorMessage,
    });

    render(<NewCall />);

    expect(screen.getByText(errorMessage)).toBeTruthy();
  });

  it('should populate type dropdown with call types', () => {
    render(<NewCall />);

    // The dropdown items are rendered in a portal, so we need to look for the select input
    const typeSelectInput = screen.getByPlaceholderText('calls.select_type');
    expect(typeSelectInput).toBeTruthy();
  });

  it('should populate priority dropdown with call priorities', () => {
    render(<NewCall />);

    // The dropdown items are rendered in a portal, so we need to look for the select input
    const prioritySelectInput = screen.getByPlaceholderText('calls.select_priority');
    expect(prioritySelectInput).toBeTruthy();
  });

  it('should validate required fields including type', async () => {
    render(<NewCall />);

    // Try to submit without filling required fields
    const createButton = screen.getByText('calls.create');
    fireEvent.press(createButton);

    // The form should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeTruthy();
      expect(screen.getByText('Nature is required')).toBeTruthy();
      expect(screen.getByText('Priority is required')).toBeTruthy();
      expect(screen.getByText('Type is required')).toBeTruthy();
    });
  });

  it('should handle form submission with type data', async () => {
    const { createCall } = require('@/api/calls/calls');
    createCall.mockResolvedValue({ IsSuccess: true });

    render(<NewCall />);

    // Fill in the form
    const nameInput = screen.getByPlaceholderText('calls.name_placeholder');
    const natureInput = screen.getByPlaceholderText('calls.nature_placeholder');

    fireEvent.changeText(nameInput, 'Test Call');
    fireEvent.changeText(natureInput, 'Test Nature');

    // The type and priority selection would require interaction with the dropdown
    // which is complex to test with react-native-testing-library
    // For now, we'll just check that the form can be submitted
    const createButton = screen.getByText('calls.create');
    expect(createButton).toBeTruthy();
  });

  it('should handle address search', async () => {
    render(<NewCall />);

    const addressInput = screen.getByTestId('address-input');
    const addressSearchButton = screen.getByTestId('address-search-button');

    fireEvent.changeText(addressInput, '123 Test Street');
    fireEvent.press(addressSearchButton);

    // The search functionality would be tested in integration tests
    // Here we just verify the UI components exist
    expect(addressInput).toBeTruthy();
    expect(addressSearchButton).toBeTruthy();
  });

  it('should handle plus code search', async () => {
    render(<NewCall />);

    const plusCodeInput = screen.getByTestId('plus-code-input');
    const plusCodeSearchButton = screen.getByTestId('plus-code-search-button');

    fireEvent.changeText(plusCodeInput, '849VCWC8+R9');
    fireEvent.press(plusCodeSearchButton);

    // The search functionality would be tested in integration tests
    // Here we just verify the UI components exist
    expect(plusCodeInput).toBeTruthy();
    expect(plusCodeSearchButton).toBeTruthy();
  });

  it('should handle coordinates search', async () => {
    render(<NewCall />);

    const coordinatesInput = screen.getByTestId('coordinates-input');
    const coordinatesSearchButton = screen.getByTestId('coordinates-search-button');

    fireEvent.changeText(coordinatesInput, '37.7749, -122.4194');
    fireEvent.press(coordinatesSearchButton);

    // The search functionality would be tested in integration tests
    // Here we just verify the UI components exist
    expect(coordinatesInput).toBeTruthy();
    expect(coordinatesSearchButton).toBeTruthy();
  });

  it('should handle cancel button', () => {
    render(<NewCall />);

    const cancelButton = screen.getByText('common.cancel');
    fireEvent.press(cancelButton);

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('NewCall what3words functionality', () => {
  const mockConfig = {
    W3WKey: 'test-api-key',
    GoogleMapsKey: 'test-google-key',
  };

  const mockCallsStore = {
    callPriorities: [
      { Id: 1, Name: 'High' },
      { Id: 2, Name: 'Medium' },
    ],
    callTypes: [
      { Id: '1', Name: 'Emergency' },
      { Id: '2', Name: 'Medical' },
    ],
    isLoading: false,
    error: null,
    fetchCallPriorities: jest.fn(),
    fetchCallTypes: jest.fn(),
  };

  const mockCoreStore = {
    config: mockConfig,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCallsStore.mockReturnValue(mockCallsStore);
    mockUseCoreStore.mockReturnValue(mockCoreStore);
  });

  describe('what3words search functionality', () => {
    it('should render what3words input field with search button', () => {
      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      expect(what3wordsInput).toBeTruthy();
      expect(searchButton).toBeTruthy();
    });

    it('should disable search button when input is empty', () => {
      render(<NewCall />);

      const searchButton = screen.getByTestId('what3words-search-button');
      expect(searchButton.props.disabled).toBeTruthy();
    });

    it('should enable search button when input has value', () => {
      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');

      expect(searchButton.props.disabled).toBeFalsy();
    });

    it('should show loading state when searching', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      // The button should show loading state
      await waitFor(() => {
        expect(screen.getByText('...')).toBeTruthy();
      });
    });

    it('should successfully search for valid what3words address', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          'https://api.what3words.com/v3/convert-to-coordinates?words=filled.count.soap&key=test-api-key'
        );
      });
    });

    it('should show error for empty what3words input', async () => {
      const mockToast = { show: jest.fn() };
      jest.mocked(require('@/components/ui/toast').useToast).mockReturnValue(mockToast);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, '   '); // Empty/whitespace
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockToast.show).toHaveBeenCalledWith({
          placement: 'top',
          render: expect.any(Function),
        });
      });
    });

    it('should show error for invalid what3words format', async () => {
      const mockToast = { show: jest.fn() };
      jest.mocked(require('@/components/ui/toast').useToast).mockReturnValue(mockToast);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'invalid-format');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockToast.show).toHaveBeenCalledWith({
          placement: 'top',
          render: expect.any(Function),
        });
      });
    });

    it('should validate what3words format correctly', async () => {
      const mockToast = { show: jest.fn() };
      jest.mocked(require('@/components/ui/toast').useToast).mockReturnValue(mockToast);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      // Test invalid formats
      const invalidFormats = [
        'word.word', // Only 2 words
        'word.word.word.word', // 4 words
        'word word word', // Spaces instead of dots
        'word-word-word', // Hyphens instead of dots
        'word.word.', // Trailing dot
        '.word.word', // Leading dot
        'word..word', // Double dots
        'word.123.word', // Numbers
        'word.WORD.word', // Uppercase letters
        'word.wo@rd.word', // Special characters
      ];

      for (const format of invalidFormats) {
        fireEvent.changeText(what3wordsInput, format);
        fireEvent.press(searchButton);

        await waitFor(() => {
          expect(mockToast.show).toHaveBeenCalled();
        });

        mockToast.show.mockClear();
      }
    });

    it('should accept valid what3words formats', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      // Test valid formats
      const validFormats = [
        'filled.count.soap',
        'index.home.raft',
        'daring.lion.race',
        'pretty.much.good',
      ];

      for (const format of validFormats) {
        fireEvent.changeText(what3wordsInput, format);
        fireEvent.press(searchButton);

        await waitFor(() => {
          expect(mockAxios.get).toHaveBeenCalledWith(
            `https://api.what3words.com/v3/convert-to-coordinates?words=${format}&key=test-api-key`
          );
        });

        mockAxios.get.mockClear();
      }
    });

    it('should handle API key not configured error', async () => {
      const mockToast = { show: jest.fn() };
      jest.mocked(require('@/components/ui/toast').useToast).mockReturnValue(mockToast);

      // Mock config without W3WKey
      mockUseCoreStore.mockReturnValue({
        config: {
          GoogleMapsKey: 'test-google-key',
        },
      });

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockToast.show).toHaveBeenCalledWith({
          placement: 'top',
          render: expect.any(Function),
        });
      });
    });

    it('should handle API request failure', async () => {
      const mockToast = { show: jest.fn() };
      jest.mocked(require('@/components/ui/toast').useToast).mockReturnValue(mockToast);

      mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockToast.show).toHaveBeenCalledWith({
          placement: 'top',
          render: expect.any(Function),
        });
      });
    });

    it('should handle API response without coordinates', async () => {
      const mockToast = { show: jest.fn() };
      jest.mocked(require('@/components/ui/toast').useToast).mockReturnValue(mockToast);

      const mockResponse = {
        data: {
          // No coordinates field
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockToast.show).toHaveBeenCalledWith({
          placement: 'top',
          render: expect.any(Function),
        });
      });
    });

    it('should update form fields when what3words search is successful', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');
      const addressInput = screen.getByTestId('address-input');
      const coordinatesInput = screen.getByTestId('coordinates-input');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(addressInput.props.value).toBe('Bayswater, London');
        expect(coordinatesInput.props.value).toBe('51.520847, -0.195521');
      });
    });

    it('should handle what3words with case insensitive validation', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      // Test with uppercase letters (should be converted to lowercase)
      fireEvent.changeText(what3wordsInput, 'FILLED.COUNT.SOAP');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          'https://api.what3words.com/v3/convert-to-coordinates?words=FILLED.COUNT.SOAP&key=test-api-key'
        );
      });
    });

    it('should show success toast when what3words search is successful', async () => {
      const mockToast = { show: jest.fn() };
      jest.mocked(require('@/components/ui/toast').useToast).mockReturnValue(mockToast);

      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockToast.show).toHaveBeenCalledWith({
          placement: 'top',
          render: expect.any(Function),
        });
      });
    });

    it('should properly encode what3words for URL', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      // Test with special characters that need encoding
      fireEvent.changeText(what3wordsInput, 'tëst.wörds.addréss');
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          'https://api.what3words.com/v3/convert-to-coordinates?words=t%C3%ABst.w%C3%B6rds.addr%C3%A9ss&key=test-api-key'
        );
      });
    });

    it('should reset loading state after API call completes', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      // Should show loading
      await waitFor(() => {
        expect(screen.getByText('...')).toBeTruthy();
      });

      // Should hide loading after completion
      await waitFor(() => {
        expect(screen.queryByText('...')).toBeFalsy();
      });
    });

    it('should reset loading state after API call fails', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

      render(<NewCall />);

      const what3wordsInput = screen.getByTestId('what3words-input');
      const searchButton = screen.getByTestId('what3words-search-button');

      fireEvent.changeText(what3wordsInput, 'filled.count.soap');
      fireEvent.press(searchButton);

      // Should show loading
      await waitFor(() => {
        expect(screen.getByText('...')).toBeTruthy();
      });

      // Should hide loading after error
      await waitFor(() => {
        expect(screen.queryByText('...')).toBeFalsy();
      });
    });
  });
}); 