import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { type ContactNoteResultData } from '@/models/v4/contacts/contactNoteResultData';
import { useContactsStore } from '@/stores/contacts/store';

import { ContactNotesList } from '../contact-notes-list';

// Mock the store
jest.mock('@/stores/contacts/store');
const mockUseContactsStore = useContactsStore as jest.MockedFunction<typeof useContactsStore>;

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'contacts.contactNotesLoading': 'Loading contact notes...',
        'contacts.contactNotesEmpty': 'No notes found for this contact',
        'contacts.contactNotesEmptyDescription': 'Notes added to this contact will appear here',
        'contacts.contactNotesExpired': 'This note has expired',
        'contacts.expires': 'Expires',
        'contacts.noteAlert': 'Alert',
        'contacts.internal': 'Internal',
        'contacts.public': 'Public',
      };
      return translations[key] || key;
    },
  }),
}));

// Sample test data
const mockContactNote: ContactNoteResultData = {
  ContactNoteId: 'note-1',
  ContactId: 'contact-1',
  ContactNoteTypeId: 'type-1',
  Note: 'Test note content',
  NoteType: 'General',
  ShouldAlert: false,
  Visibility: 0, // Internal
  ExpiresOnUtc: new Date('2024-12-31'),
  ExpiresOn: '2024-12-31',
  IsDeleted: false,
  AddedOnUtc: new Date('2023-01-01'),
  AddedOn: '2023-01-01',
  AddedByUserId: 'user-1',
  AddedByName: 'John Admin',
  EditedOnUtc: new Date('2023-01-01'),
  EditedOn: '2023-01-01',
  EditedByUserId: 'user-1',
  EditedByName: 'John Admin',
};

const mockExpiredNote: ContactNoteResultData = {
  ...mockContactNote,
  ContactNoteId: 'note-2',
  Note: 'Expired note content',
  ExpiresOnUtc: new Date('2022-01-01'), // Expired
  ExpiresOn: '2022-01-01',
};

const mockPublicNote: ContactNoteResultData = {
  ...mockContactNote,
  ContactNoteId: 'note-3',
  Note: 'Public note content',
  Visibility: 1, // Public
};

const mockAlertNote: ContactNoteResultData = {
  ...mockContactNote,
  ContactNoteId: 'note-4',
  Note: 'Alert note content',
  ShouldAlert: true,
};

describe('ContactNotesList', () => {
  const mockFetchContactNotes = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('should display loading spinner when notes are loading', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: {},
        isNotesLoading: true,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('Loading contact notes...')).toBeTruthy();
    });
  });

  describe('empty state', () => {
    it('should display empty state when no notes exist', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('No notes found for this contact')).toBeTruthy();
      expect(screen.getByText('Notes added to this contact will appear here')).toBeTruthy();
    });

    it('should display empty state when contact notes do not exist in store', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: {},
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('No notes found for this contact')).toBeTruthy();
    });
  });

  describe('notes display', () => {
    it('should display notes correctly', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [mockContactNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('Test note content')).toBeTruthy();
      expect(screen.getByText('General')).toBeTruthy();
      expect(screen.getByText('John Admin')).toBeTruthy();
      expect(screen.getByText('Internal')).toBeTruthy();
    });

    it('should display multiple notes', () => {
      const notes = [mockContactNote, mockPublicNote];

      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': notes },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('Test note content')).toBeTruthy();
      expect(screen.getByText('Public note content')).toBeTruthy();
    });
  });

  describe('note visibility', () => {
    it('should display internal visibility indicator', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [mockContactNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('Internal')).toBeTruthy();
    });

    it('should display public visibility indicator', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [mockPublicNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('Public')).toBeTruthy();
    });
  });

  describe('note alerts', () => {
    it('should display alert indicator for notes with ShouldAlert=true', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [mockAlertNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('Alert')).toBeTruthy();
    });

    it('should not display alert indicator for notes with ShouldAlert=false', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [mockContactNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.queryByText('Alert')).toBeFalsy();
    });
  });

  describe('note expiration', () => {
    it('should display expiration warning for expired notes', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [mockExpiredNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText('This note has expired')).toBeTruthy();
    });

    it('should display expiration date for non-expired notes', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [mockContactNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(screen.getByText(/Expires:/)).toBeTruthy();
    });
  });

  describe('API integration', () => {
    it('should call fetchContactNotes when component mounts', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: {},
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      expect(mockFetchContactNotes).toHaveBeenCalledWith('contact-1');
    });

    it('should call fetchContactNotes when contactId changes', () => {
      mockUseContactsStore.mockReturnValue({
        contactNotes: {},
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      const { rerender } = render(<ContactNotesList contactId="contact-1" />);

      rerender(<ContactNotesList contactId="contact-2" />);

      expect(mockFetchContactNotes).toHaveBeenCalledWith('contact-1');
      expect(mockFetchContactNotes).toHaveBeenCalledWith('contact-2');
      expect(mockFetchContactNotes).toHaveBeenCalledTimes(2);
    });
  });

  describe('note sorting', () => {
    it('should sort notes by date with newest first', () => {
      const oldNote = {
        ...mockContactNote,
        ContactNoteId: 'note-old',
        Note: 'Old note',
        AddedOnUtc: new Date('2022-01-01'),
        AddedOn: '2022-01-01',
      };

      const newNote = {
        ...mockContactNote,
        ContactNoteId: 'note-new',
        Note: 'New note',
        AddedOnUtc: new Date('2023-12-01'),
        AddedOn: '2023-12-01',
      };

      mockUseContactsStore.mockReturnValue({
        contactNotes: { 'contact-1': [oldNote, newNote] },
        isNotesLoading: false,
        fetchContactNotes: mockFetchContactNotes,
        contacts: [],
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: false,
        isLoading: false,
        error: null,
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: jest.fn(),
        fetchContacts: jest.fn(),
      });

      render(<ContactNotesList contactId="contact-1" />);

      const noteElements = screen.getAllByText(/note/i);
      // The newest note should appear first in the list
      expect(noteElements[0]).toHaveTextContent('New note');
    });
  });
}); 