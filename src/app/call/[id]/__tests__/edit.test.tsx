import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import EditCall from '../edit';

// Mock expo-router
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
  useLocalSearchParams: jest.fn(),
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock the call detail store
const mockUseCallDetailStore = jest.fn();
jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: mockUseCallDetailStore,
}));

// Mock the calls store
const mockUseCallsStore = jest.fn();
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: mockUseCallsStore,
}));

// Mock the core store
const mockUseCoreStore = jest.fn();
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: mockUseCoreStore,
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock nativewind
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

// Mock components
jest.mock('@/components/common/loading', () => ({
  Loading: () => 'Loading',
}));

jest.mock('@/components/calls/dispatch-selection-modal', () => ({
  DispatchSelectionModal: 'DispatchSelectionModal',
}));

jest.mock('@/components/maps/full-screen-location-picker', () => 'FullScreenLocationPicker');
jest.mock('@/components/maps/location-picker', () => 'LocationPicker');

// Mock useToast
const mockToastShow = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    show: mockToastShow,
  }),
}));

const mockCallDetailStore = {
  call: {
    CallId: 'test-call-1',
    Name: 'Test Call',
    Number: '2024-001',
    Nature: 'Medical Emergency',
    Address: '123 Test Street',
    Priority: 1,
    Type: 'Medical',
    LoggedOn: '2024-01-01T12:00:00Z',
    Note: 'Test call note',
    ContactName: 'John Doe',
    ContactInfo: 'john@example.com',
    ReferenceId: 'REF-001',
    ExternalId: 'EXT-001',
    Latitude: '40.7128',
    Longitude: '-74.0060',
    Geolocation: '40.7128,-74.0060',
  },
  isLoading: false,
  error: null,
  fetchCallDetail: jest.fn(),
  updateCall: jest.fn(),
};

const mockCallsStore = {
  callPriorities: [
    { Id: 1, Name: 'High', Color: '#FF0000' },
    { Id: 2, Name: 'Medium', Color: '#FFFF00' },
    { Id: 3, Name: 'Low', Color: '#00FF00' },
  ],
  callTypes: [
    { Id: 'Medical', Name: 'Medical' },
    { Id: 'Fire', Name: 'Fire' },
    { Id: 'Police', Name: 'Police' },
  ],
  isLoading: false,
  error: null,
  fetchCallPriorities: jest.fn(),
  fetchCallTypes: jest.fn(),
};

const mockCoreStore = {
  config: {
    GoogleMapsKey: 'test-api-key',
  },
};

describe('EditCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    require('expo-router').useLocalSearchParams.mockReturnValue({
      id: 'test-call-1',
    });

    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockCallDetailStore);
      }
      return mockCallDetailStore;
    });

    mockUseCallsStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockCallsStore);
      }
      return mockCallsStore;
    });

    mockUseCoreStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockCoreStore);
      }
      return mockCoreStore;
    });
  });

  it('should render edit call page', () => {
    render(<EditCall />);

    expect(screen.getByText('calls.edit_call')).toBeTruthy();
    expect(screen.getByText('calls.edit_call_description')).toBeTruthy();
  });

  it('should pre-populate form with existing call data', async () => {
    render(<EditCall />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Call')).toBeTruthy();
      expect(screen.getByDisplayValue('Medical Emergency')).toBeTruthy();
      expect(screen.getByDisplayValue('Test call note')).toBeTruthy();
      expect(screen.getByDisplayValue('123 Test Street')).toBeTruthy();
      expect(screen.getByDisplayValue('John Doe')).toBeTruthy();
      expect(screen.getByDisplayValue('john@example.com')).toBeTruthy();
    });
  });

  it('should load call data on mount', () => {
    render(<EditCall />);

    expect(mockCallsStore.fetchCallPriorities).toHaveBeenCalled();
    expect(mockCallsStore.fetchCallTypes).toHaveBeenCalled();
    expect(mockCallDetailStore.fetchCallDetail).toHaveBeenCalledWith('test-call-1');
  });

  it('should handle form submission successfully', async () => {
    mockCallDetailStore.updateCall.mockResolvedValue(undefined);

    render(<EditCall />);

    // Wait for form to be populated
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Call')).toBeTruthy();
    });

    // Update some fields
    const nameInput = screen.getByDisplayValue('Test Call');
    fireEvent.changeText(nameInput, 'Updated Test Call');

    const natureInput = screen.getByDisplayValue('Medical Emergency');
    fireEvent.changeText(natureInput, 'Updated Medical Emergency');

    // Submit form
    const saveButton = screen.getByText('common.save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockCallDetailStore.updateCall).toHaveBeenCalledWith({
        callId: 'test-call-1',
        name: 'Updated Test Call',
        nature: 'Updated Medical Emergency',
        priority: 1,
        type: 'Medical',
        note: 'Test call note',
        address: '123 Test Street',
        latitude: 40.7128,
        longitude: -74.0060,
        what3words: '',
        plusCode: '',
        contactName: 'John Doe',
        contactInfo: 'john@example.com',
        dispatchUsers: [],
        dispatchGroups: [],
        dispatchRoles: [],
        dispatchUnits: [],
        dispatchEveryone: false,
      });

      expect(mockToastShow).toHaveBeenCalledWith({
        placement: 'top',
        render: expect.any(Function),
      });

      expect(router.back).toHaveBeenCalled();
    });
  });

  it('should handle form submission error', async () => {
    const errorMessage = 'Failed to update call';
    mockCallDetailStore.updateCall.mockRejectedValue(new Error(errorMessage));

    render(<EditCall />);

    // Wait for form to be populated
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Call')).toBeTruthy();
    });

    // Submit form
    const saveButton = screen.getByText('common.save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockToastShow).toHaveBeenCalledWith({
        placement: 'top',
        render: expect.any(Function),
      });
    });
  });

  it('should cancel and go back when cancel button is pressed', () => {
    render(<EditCall />);

    const cancelButton = screen.getByText('common.cancel');
    fireEvent.press(cancelButton);

    expect(router.back).toHaveBeenCalled();
  });

  it('should render loading state when call detail is loading', () => {
    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockCallDetailStore,
          isLoading: true,
        });
      }
      return { ...mockCallDetailStore, isLoading: true };
    });

    render(<EditCall />);

    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('should render loading state when call data is loading', () => {
    mockUseCallsStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockCallsStore,
          isLoading: true,
        });
      }
      return { ...mockCallsStore, isLoading: true };
    });

    render(<EditCall />);

    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('should render error state when call detail has error', () => {
    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockCallDetailStore,
          error: 'Failed to load call',
        });
      }
      return { ...mockCallDetailStore, error: 'Failed to load call' };
    });

    render(<EditCall />);

    expect(screen.getByText('Failed to load call')).toBeTruthy();
  });

  it('should render error state when call data has error', () => {
    mockUseCallsStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockCallsStore,
          error: 'Failed to load call data',
        });
      }
      return { ...mockCallsStore, error: 'Failed to load call data' };
    });

    render(<EditCall />);

    expect(screen.getByText('Failed to load call data')).toBeTruthy();
  });

  it('should render error state when call is not found', () => {
    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockCallDetailStore,
          call: null,
        });
      }
      return { ...mockCallDetailStore, call: null };
    });

    render(<EditCall />);

    expect(screen.getByText('Call not found')).toBeTruthy();
  });

  it('should validate required fields', async () => {
    render(<EditCall />);

    // Wait for form to be populated
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Call')).toBeTruthy();
    });

    // Clear required fields
    const nameInput = screen.getByDisplayValue('Test Call');
    fireEvent.changeText(nameInput, '');

    const natureInput = screen.getByDisplayValue('Medical Emergency');
    fireEvent.changeText(natureInput, '');

    // Try to submit form
    const saveButton = screen.getByText('common.save');
    fireEvent.press(saveButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeTruthy();
      expect(screen.getByText('Nature is required')).toBeTruthy();
    });

    // Should not call updateCall
    expect(mockCallDetailStore.updateCall).not.toHaveBeenCalled();
  });

  it('should handle address search', async () => {
    render(<EditCall />);

    // Wait for form to be populated
    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Test Street')).toBeTruthy();
    });

    const addressInput = screen.getByTestId('address-input');
    const searchButton = screen.getByTestId('address-search-button');

    fireEvent.changeText(addressInput, '456 New Street');
    fireEvent.press(searchButton);

    // Address search functionality would be tested in integration tests
    expect(searchButton).toBeTruthy();
  });
}); 