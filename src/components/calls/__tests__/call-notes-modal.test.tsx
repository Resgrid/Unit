import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/lib/auth';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import CallNotesModal from '../call-notes-modal';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: jest.fn(),
}));

jest.mock('../../common/loading', () => ({
  Loading: jest.fn(() => <div data-testid="loading-spinner">Loading...</div>),
}));

jest.mock('../../common/zero-state', () => {
  return jest.fn(({ heading }: { heading: string }) => (
    <div data-testid="zero-state">{heading}</div>
  ));
});

// Mock react-native-keyboard-controller
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="keyboard-aware-scroll-view">{children}</div>
  ),
}));

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseCallDetailStore = useCallDetailStore as jest.MockedFunction<typeof useCallDetailStore>;

describe('CallNotesModal', () => {
  const mockFetchCallNotes = jest.fn();
  const mockAddNote = jest.fn();
  const mockSearchNotes = jest.fn();
  const mockOnClose = jest.fn();

  const mockTranslation = {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'callNotes.title': 'Call Notes',
        'callNotes.searchPlaceholder': 'Search notes...',
        'callNotes.addNotePlaceholder': 'Add a note...',
        'callNotes.addNote': 'Add Note',
      };
      return translations[key] || key;
    },
    i18n: {} as any,
    ready: true,
  };

  const mockAuthStore = {
    profile: { sub: 'user123' },
  };

  const mockCallDetailStore = {
    callNotes: [],
    addNote: mockAddNote,
    searchNotes: mockSearchNotes,
    isNotesLoading: false,
    fetchCallNotes: mockFetchCallNotes,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue(mockTranslation as any);
    mockUseAuthStore.mockReturnValue(mockAuthStore);
    mockUseCallDetailStore.mockReturnValue(mockCallDetailStore);
    mockSearchNotes.mockReturnValue([]);
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    callId: 'call123',
  };

  describe('Initial Rendering', () => {
    it('should render the modal with correct title', () => {
      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByText('Call Notes')).toBeTruthy();
    });

    it('should render search input with correct placeholder', () => {
      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search notes...')).toBeTruthy();
    });

    it('should render textarea with correct placeholder', () => {
      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByPlaceholderText('Add a note...')).toBeTruthy();
    });

    it('should render add note button', () => {
      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByText('Add Note')).toBeTruthy();
    });
  });

  describe('Fetching Notes', () => {
    it('should fetch call notes when modal opens', () => {
      render(<CallNotesModal {...defaultProps} />);

      expect(mockFetchCallNotes).toHaveBeenCalledWith('call123');
    });

    it('should not fetch call notes when modal is closed', () => {
      render(<CallNotesModal {...defaultProps} isOpen={false} />);

      expect(mockFetchCallNotes).not.toHaveBeenCalled();
    });

    it('should not fetch call notes when callId is empty', () => {
      render(<CallNotesModal {...defaultProps} callId="" />);

      expect(mockFetchCallNotes).not.toHaveBeenCalled();
    });

    it('should refetch notes when callId changes', () => {
      const { rerender } = render(<CallNotesModal {...defaultProps} callId="call1" />);

      expect(mockFetchCallNotes).toHaveBeenCalledWith('call1');

      rerender(<CallNotesModal {...defaultProps} callId="call2" />);

      expect(mockFetchCallNotes).toHaveBeenCalledWith('call2');
      expect(mockFetchCallNotes).toHaveBeenCalledTimes(2);
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when notes are loading', () => {
      mockUseCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        isNotesLoading: true,
      });

      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByTestId('loading-spinner')).toBeTruthy();
    });

    it('should hide loading spinner when notes are not loading', () => {
      mockUseCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        isNotesLoading: false,
      });

      render(<CallNotesModal {...defaultProps} />);

      expect(screen.queryByTestId('loading-spinner')).toBeFalsy();
    });

    it('should disable add note button when loading', () => {
      mockUseCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        isNotesLoading: true,
      });

      render(<CallNotesModal {...defaultProps} />);

      const addButton = screen.getByText('Add Note').parent;
      expect(addButton?.props.disabled).toBeTruthy();
    });
  });

  describe('Displaying Notes', () => {
    const mockNotes = [
      {
        CallNoteId: '1',
        Note: 'First note',
        FullName: 'John Doe',
        TimestampFormatted: '2023-01-01 10:00',
      },
      {
        CallNoteId: '2',
        Note: 'Second note',
        FullName: 'Jane Smith',
        TimestampFormatted: '2023-01-01 11:00',
      },
    ];

    it('should display notes correctly', () => {
      mockUseCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        callNotes: mockNotes,
      });
      mockSearchNotes.mockReturnValue(mockNotes);

      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByText('First note')).toBeTruthy();
      expect(screen.getByText('Second note')).toBeTruthy();
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('Jane Smith')).toBeTruthy();
      expect(screen.getByText('2023-01-01 10:00')).toBeTruthy();
      expect(screen.getByText('2023-01-01 11:00')).toBeTruthy();
    });

    it('should show zero state when no notes', () => {
      mockUseCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        callNotes: [],
      });
      mockSearchNotes.mockReturnValue([]);

      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByTestId('zero-state')).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    const mockNotes = [
      {
        CallNoteId: '1',
        Note: 'First note',
        FullName: 'John Doe',
        TimestampFormatted: '2023-01-01 10:00',
      },
      {
        CallNoteId: '2',
        Note: 'Second note',
        FullName: 'Jane Smith',
        TimestampFormatted: '2023-01-01 11:00',
      },
    ];

    it('should call searchNotes when search input changes', () => {
      mockUseCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        callNotes: mockNotes,
      });

      render(<CallNotesModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.changeText(searchInput, 'first');

      expect(mockSearchNotes).toHaveBeenCalledWith('first');
    });

    it('should display filtered notes', () => {
      mockUseCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        callNotes: mockNotes,
      });
      mockSearchNotes.mockReturnValue([mockNotes[0]]);

      render(<CallNotesModal {...defaultProps} />);

      expect(screen.getByText('First note')).toBeTruthy();
      expect(screen.queryByText('Second note')).toBeFalsy();
    });
  });

  describe('Adding Notes', () => {
    it('should call addNote when add note button is pressed', async () => {
      render(<CallNotesModal {...defaultProps} />);

      const noteInput = screen.getByPlaceholderText('Add a note...');
      const addButton = screen.getByText('Add Note');

      fireEvent.changeText(noteInput, 'New note content');
      fireEvent.press(addButton);

      await waitFor(() => {
        expect(mockAddNote).toHaveBeenCalledWith('call123', 'New note content', 'user123', null, null);
      });
    });

    it('should clear note input after adding note', async () => {
      render(<CallNotesModal {...defaultProps} />);

      const noteInput = screen.getByPlaceholderText('Add a note...');
      const addButton = screen.getByText('Add Note');

      fireEvent.changeText(noteInput, 'New note content');
      fireEvent.press(addButton);

      await waitFor(() => {
        expect(noteInput.props.value).toBe('');
      });
    });

    it('should not call addNote when note is empty', async () => {
      render(<CallNotesModal {...defaultProps} />);

      const addButton = screen.getByText('Add Note');

      fireEvent.press(addButton);

      expect(mockAddNote).not.toHaveBeenCalled();
    });

    it('should not call addNote when note is only whitespace', async () => {
      render(<CallNotesModal {...defaultProps} />);

      const noteInput = screen.getByPlaceholderText('Add a note...');
      const addButton = screen.getByText('Add Note');

      fireEvent.changeText(noteInput, '   ');
      fireEvent.press(addButton);

      expect(mockAddNote).not.toHaveBeenCalled();
    });

    it('should disable add note button when input is empty', () => {
      render(<CallNotesModal {...defaultProps} />);

      const addButton = screen.getByText('Add Note').parent;
      expect(addButton?.props.disabled).toBeTruthy();
    });

    it('should enable add note button when input has content', () => {
      render(<CallNotesModal {...defaultProps} />);

      const noteInput = screen.getByPlaceholderText('Add a note...');
      fireEvent.changeText(noteInput, 'Some content');

      const addButton = screen.getByText('Add Note').parent;
      expect(addButton?.props.disabled).toBeFalsy();
    });
  });

  describe('Modal Controls', () => {
    it('should call onClose when close button is pressed', () => {
      render(<CallNotesModal {...defaultProps} />);

      const closeButton = screen.getByTestId('close-button');
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when backdrop is pressed', () => {
      render(<CallNotesModal {...defaultProps} />);

      const backdrop = screen.getByTestId('actionsheet-backdrop');
      fireEvent.press(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should handle missing profile', () => {
      mockUseAuthStore.mockReturnValue({
        profile: null,
      });

      render(<CallNotesModal {...defaultProps} />);

      const noteInput = screen.getByPlaceholderText('Add a note...');
      const addButton = screen.getByText('Add Note');

      fireEvent.changeText(noteInput, 'Test note');
      fireEvent.press(addButton);

      expect(mockAddNote).toHaveBeenCalledWith('call123', 'Test note', '', null, null);
    });

    it('should handle missing profile.sub', () => {
      mockUseAuthStore.mockReturnValue({
        profile: {},
      });

      render(<CallNotesModal {...defaultProps} />);

      const noteInput = screen.getByPlaceholderText('Add a note...');
      const addButton = screen.getByText('Add Note');

      fireEvent.changeText(noteInput, 'Test note');
      fireEvent.press(addButton);

      expect(mockAddNote).toHaveBeenCalledWith('call123', 'Test note', '', null, null);
    });
  });
}); 