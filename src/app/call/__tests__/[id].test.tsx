import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import CallDetail from '../[id]';

// Mock expo-router
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock the call detail store
const mockUseCallDetailStore = jest.fn();
jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: mockUseCallDetailStore,
}));

// Mock the toast store
const mockShowToast = jest.fn();
jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn(() => ({ showToast: mockShowToast })),
}));

// Mock the location store
const mockUseLocationStore = jest.fn();
jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: mockUseLocationStore,
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

// Mock WebView
jest.mock('react-native-webview', () => 'WebView');

// Mock components
jest.mock('@/components/common/loading', () => ({
  Loading: () => 'Loading',
}));

jest.mock('@/components/common/zero-state', () => 'ZeroState');

jest.mock('@/components/maps/static-map', () => 'StaticMap');

jest.mock('../../components/calls/call-files-modal', () => 'CallFilesModal');
jest.mock('../../components/calls/call-images-modal', () => 'CallImagesModal');
jest.mock('../../components/calls/call-notes-modal', () => 'CallNotesModal');

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
};

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
    NotesCount: 2,
    ImgagesCount: 1,
    FileCount: 3,
  },
  callExtraData: {
    Protocols: [],
    Dispatches: [],
    Activity: [],
  },
  callPriority: {
    Id: 1,
    Name: 'High',
    Color: '#FF0000',
  },
  isLoading: false,
  error: null,
  fetchCallDetail: jest.fn(),
  reset: jest.fn(),
  fetchCallNotes: jest.fn(),
  closeCall: jest.fn(),
};

describe('CallDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (router as any) = mockRouter;

    require('expo-router').useLocalSearchParams.mockReturnValue({
      id: 'test-call-1',
    });

    require('expo-router').useRouter.mockReturnValue(mockRouter);

    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockCallDetailStore);
      }
      return mockCallDetailStore;
    });

    mockUseLocationStore.mockReturnValue({
      latitude: 40.7589,
      longitude: -73.9851,
    });
  });

  it('should render call detail page with kebab menu', () => {
    render(<CallDetail />);

    expect(screen.getByText('call_detail.title')).toBeTruthy();
    expect(screen.getByText('Test Call (2024-001)')).toBeTruthy();
  });

  it('should open kebab menu when menu button is pressed', async () => {
    render(<CallDetail />);

    // Find and press the kebab menu button
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    await waitFor(() => {
      expect(screen.getByText('call_detail.edit_call')).toBeTruthy();
      expect(screen.getByText('call_detail.close_call')).toBeTruthy();
    });
  });

  it('should navigate to edit page when Edit Call is pressed', async () => {
    render(<CallDetail />);

    // Open kebab menu
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    await waitFor(() => {
      const editButton = screen.getByText('call_detail.edit_call');
      fireEvent.press(editButton);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/call/test-call-1/edit');
  });

  it('should open close call modal when Close Call is pressed', async () => {
    render(<CallDetail />);

    // Open kebab menu
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    await waitFor(() => {
      const closeButton = screen.getByText('call_detail.close_call');
      fireEvent.press(closeButton);
    });

    await waitFor(() => {
      expect(screen.getByText('call_detail.close_call_type')).toBeTruthy();
      expect(screen.getByText('call_detail.close_call_note')).toBeTruthy();
    });
  });

  it('should show error when closing call without selecting type', async () => {
    render(<CallDetail />);

    // Open kebab menu and select close call
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    await waitFor(() => {
      const closeButton = screen.getByText('call_detail.close_call');
      fireEvent.press(closeButton);
    });

    // Try to submit without selecting type
    await waitFor(() => {
      const submitButton = screen.getAllByText('call_detail.close_call')[1]; // Second one is the submit button
      fireEvent.press(submitButton);
    });

    expect(mockShowToast).toHaveBeenCalledWith('error', 'call_detail.close_call_type_required');
  });

  it('should successfully close call with valid data', async () => {
    mockCallDetailStore.closeCall.mockResolvedValue(undefined);

    render(<CallDetail />);

    // Open kebab menu and select close call
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    await waitFor(() => {
      const closeButton = screen.getByText('call_detail.close_call');
      fireEvent.press(closeButton);
    });

    // Select close type
    await waitFor(() => {
      const typeSelect = screen.getByPlaceholderText('call_detail.close_call_type_placeholder');
      fireEvent(typeSelect, 'onValueChange', 'resolved');
    });

    // Add note
    const noteInput = screen.getByPlaceholderText('call_detail.close_call_note_placeholder');
    fireEvent.changeText(noteInput, 'Call resolved successfully');

    // Submit
    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockCallDetailStore.closeCall).toHaveBeenCalledWith({
        callId: 'test-call-1',
        type: 'resolved',
        note: 'Call resolved successfully',
      });
      expect(mockShowToast).toHaveBeenCalledWith('success', 'call_detail.close_call_success');
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('should handle close call error', async () => {
    const errorMessage = 'Failed to close call';
    mockCallDetailStore.closeCall.mockRejectedValue(new Error(errorMessage));

    render(<CallDetail />);

    // Open kebab menu and select close call
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    await waitFor(() => {
      const closeButton = screen.getByText('call_detail.close_call');
      fireEvent.press(closeButton);
    });

    // Select close type and submit
    await waitFor(() => {
      const typeSelect = screen.getByPlaceholderText('call_detail.close_call_type_placeholder');
      fireEvent(typeSelect, 'onValueChange', 'resolved');
    });

    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'call_detail.close_call_error');
    });
  });

  it('should render loading state', () => {
    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockCallDetailStore,
          isLoading: true,
        });
      }
      return { ...mockCallDetailStore, isLoading: true };
    });

    render(<CallDetail />);

    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('should render error state', () => {
    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockCallDetailStore,
          error: 'Failed to load call',
        });
      }
      return { ...mockCallDetailStore, error: 'Failed to load call' };
    });

    render(<CallDetail />);

    expect(screen.getByText('ZeroState')).toBeTruthy();
  });

  it('should cancel close call modal', async () => {
    render(<CallDetail />);

    // Open close call modal
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    await waitFor(() => {
      const closeButton = screen.getByText('call_detail.close_call');
      fireEvent.press(closeButton);
    });

    // Cancel
    const cancelButton = screen.getByText('common.cancel');
    fireEvent.press(cancelButton);

    // Modal should be closed (we can't easily test this with current setup)
    // But we can verify no calls were made
    expect(mockCallDetailStore.closeCall).not.toHaveBeenCalled();
  });
}); 