// what3words functionality tests for NewCall component
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import axios from 'axios';
import NewCall from '../index';

// Mock axios
const mockAxios = jest.mocked(axios);

// Mock stores
const mockUseCoreStore = jest.fn();
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: mockUseCoreStore,
}));

const mockUseCallsStore = jest.fn();
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: mockUseCallsStore,
}));

// Mock toast
const mockToast = { show: jest.fn() };
jest.mock('@/components/ui/toast', () => ({
  useToast: () => mockToast,
}));

// Mock all required components
jest.mock('@/components/calls/dispatch-selection-modal', () => ({
  DispatchSelectionModal: () => null,
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: () => null,
}));

jest.mock('@/components/maps/full-screen-location-picker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/maps/location-picker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/common/loading', () => ({
  Loading: () => null,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
}));

describe('what3words functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock core store with what3words API key
    mockUseCoreStore.mockReturnValue({
      config: {
        W3WKey: 'test-what3words-key',
        GoogleMapsKey: 'test-google-key',
      },
    });

    // Mock calls store
    mockUseCallsStore.mockReturnValue({
      callPriorities: [
        { Id: 1, Name: 'High' },
        { Id: 2, Name: 'Medium' },
        { Id: 3, Name: 'Low' },
      ],
      callTypes: [
        { Id: 'emergency', Name: 'Emergency' },
        { Id: 'medical', Name: 'Medical' },
      ],
      isLoading: false,
      error: null,
      fetchCallPriorities: jest.fn(),
      fetchCallTypes: jest.fn(),
    });

    // Mock axios
    mockAxios.get = jest.fn();
    mockAxios.post = jest.fn();
  });

  it('should validate what3words format correctly', async () => {
    render(<NewCall />);

    const what3wordsInput = screen.getByTestId('what3words-input');
    const searchButton = screen.getByTestId('what3words-search-button');

    // Test invalid formats
    const invalidFormats = [
      'invalid-format',
      'two.words',
      'four.words.here.extra',
      'word.with.CAPITALS',
      'word.with.123',
      'word.with.spaces here',
      'word.with.',
      '.word.with',
      'word..with',
    ];

    for (const format of invalidFormats) {
      fireEvent.changeText(what3wordsInput, format);
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockToast.show).toHaveBeenCalledWith({
          placement: 'top',
          render: expect.any(Function),
        });
      });
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
    ];

    for (const format of validFormats) {
      fireEvent.changeText(what3wordsInput, format);
      fireEvent.press(searchButton);

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          `https://api.what3words.com/v3/convert-to-coordinates?words=${format}&key=test-what3words-key`
        );
      });
    }
  });

  it('should handle empty what3words input', async () => {
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

    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it('should handle missing API key', async () => {
    // Mock core store without API key
    mockUseCoreStore.mockReturnValue({
      config: {
        W3WKey: '', // Empty API key
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

    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it('should handle successful what3words API response', async () => {
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

    fireEvent.changeText(what3wordsInput, 'filled.count.soap');
    fireEvent.press(searchButton);

    await waitFor(() => {
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.what3words.com/v3/convert-to-coordinates?words=filled.count.soap&key=test-what3words-key'
      );
    });

    await waitFor(() => {
      expect(mockToast.show).toHaveBeenCalledWith({
        placement: 'top',
        render: expect.any(Function),
      });
    });
  });

  it('should handle what3words API errors', async () => {
    mockAxios.get.mockRejectedValue(new Error('Network error'));

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

  it('should handle what3words not found response', async () => {
    const mockResponse = {
      data: {
        coordinates: null, // No coordinates found
      },
    };

    mockAxios.get.mockResolvedValue(mockResponse);

    render(<NewCall />);

    const what3wordsInput = screen.getByTestId('what3words-input');
    const searchButton = screen.getByTestId('what3words-search-button');

    fireEvent.changeText(what3wordsInput, 'invalid.what3words.address');
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

    mockAxios.get.mockResolvedValue(mockResponse);

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

  it('should properly encode special characters in what3words', async () => {
    const mockResponse = {
      data: {
        coordinates: {
          lat: 51.520847,
          lng: -0.195521,
        },
        nearestPlace: 'Test Location',
        words: 'test.words.address',
      },
    };

    mockAxios.get.mockResolvedValue(mockResponse);

    render(<NewCall />);

    const what3wordsInput = screen.getByTestId('what3words-input');
    const searchButton = screen.getByTestId('what3words-search-button');

    // Test with special characters that need URL encoding
    fireEvent.changeText(what3wordsInput, 'tëst.wörds.addréss');
    fireEvent.press(searchButton);

    await waitFor(() => {
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.what3words.com/v3/convert-to-coordinates?words=t%C3%ABst.w%C3%B6rds.addr%C3%A9ss&key=test-what3words-key'
      );
    });
  });

  it('should show loading state during API call', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockAxios.get.mockReturnValue(promise);

    render(<NewCall />);

    const what3wordsInput = screen.getByTestId('what3words-input');
    const searchButton = screen.getByTestId('what3words-search-button');

    fireEvent.changeText(what3wordsInput, 'filled.count.soap');
    fireEvent.press(searchButton);

    // Should show loading indicator
    await waitFor(() => {
      expect(screen.getByText('...')).toBeTruthy();
    });

    // Resolve the promise
    resolvePromise({
      data: {
        coordinates: {
          lat: 51.520847,
          lng: -0.195521,
        },
        nearestPlace: 'Bayswater, London',
        words: 'filled.count.soap',
      },
    });

    // Should hide loading indicator
    await waitFor(() => {
      expect(screen.queryByText('...')).toBeFalsy();
    });
  });

  it('should disable search button when input is empty', () => {
    render(<NewCall />);

    const what3wordsInput = screen.getByTestId('what3words-input');
    const searchButton = screen.getByTestId('what3words-search-button');

    // Button should be disabled when input is empty
    expect(searchButton).toBeDisabled();

    // Button should be enabled when input has value
    fireEvent.changeText(what3wordsInput, 'filled.count.soap');
    expect(searchButton).not.toBeDisabled();
  });

  it('should disable search button during API call', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockAxios.get.mockReturnValue(promise);

    render(<NewCall />);

    const what3wordsInput = screen.getByTestId('what3words-input');
    const searchButton = screen.getByTestId('what3words-search-button');

    fireEvent.changeText(what3wordsInput, 'filled.count.soap');
    fireEvent.press(searchButton);

    // Button should be disabled during API call
    await waitFor(() => {
      expect(searchButton).toBeDisabled();
    });

    // Resolve the promise
    resolvePromise({
      data: {
        coordinates: {
          lat: 51.520847,
          lng: -0.195521,
        },
        nearestPlace: 'Bayswater, London',
        words: 'filled.count.soap',
      },
    });

    // Button should be enabled after API call
    await waitFor(() => {
      expect(searchButton).not.toBeDisabled();
    });
  });
});
