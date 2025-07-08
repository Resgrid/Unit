import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ContactType } from '@/models/v4/contacts/contactResultData';

import Contacts from '../contacts';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/stores/contacts/store', () => ({
  useContactsStore: jest.fn(),
}));

jest.mock('@/components/common/loading', () => ({
  Loading: () => 'Loading',
}));

jest.mock('@/components/common/zero-state', () => ({
  __esModule: true,
  default: ({ heading }: { heading: string }) => `ZeroState: ${heading}`,
}));

jest.mock('@/components/contacts/contact-card', () => ({
  ContactCard: ({ contact, onPress }: { contact: any; onPress: (id: string) => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID={`contact-card-${contact.ContactId}`} onPress={() => onPress(contact.ContactId)}>
        <Text>{contact.Name}</Text>
      </Pressable>
    );
  },
}));

jest.mock('@/components/contacts/contact-details-sheet', () => ({
  ContactDetailsSheet: () => 'ContactDetailsSheet',
}));

jest.mock('nativewind', () => ({
  styled: (component: any) => component,
}));

const { useContactsStore } = require('@/stores/contacts/store');

const mockContacts = [
  {
    ContactId: '1',
    Name: 'John Doe',
    Type: ContactType.Person,
    FirstName: 'John',
    LastName: 'Doe',
    Email: 'john@example.com',
    Phone: '555-1234',
    IsImportant: true,
    CompanyName: null,
    OtherName: null,
    IsDeleted: false,
    AddedOnUtc: new Date(),
  },
  {
    ContactId: '2',
    Name: 'Jane Smith',
    Type: ContactType.Person,
    FirstName: 'Jane',
    LastName: 'Smith',
    Email: 'jane@example.com',
    Phone: '555-5678',
    IsImportant: false,
    CompanyName: null,
    OtherName: null,
    IsDeleted: false,
    AddedOnUtc: new Date(),
  },
  {
    ContactId: '3',
    Name: 'Acme Corp',
    Type: ContactType.Company,
    FirstName: null,
    LastName: null,
    Email: 'info@acme.com',
    Phone: '555-9999',
    IsImportant: false,
    CompanyName: 'Acme Corp',
    OtherName: null,
    IsDeleted: false,
    AddedOnUtc: new Date(),
  },
];

describe('Contacts Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state during initial fetch', () => {
    useContactsStore.mockReturnValue({
      contacts: [],
      searchQuery: '',
      setSearchQuery: jest.fn(),
      selectContact: jest.fn(),
      isLoading: true,
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('should render contacts list when data is loaded', async () => {
    const mockFetchContacts = jest.fn();
    const mockSelectContact = jest.fn();
    const mockSetSearchQuery = jest.fn();

    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: '',
      setSearchQuery: mockSetSearchQuery,
      selectContact: mockSelectContact,
      isLoading: false,
      fetchContacts: mockFetchContacts,
    });

    render(<Contacts />);

    await waitFor(() => {
      expect(screen.getByTestId('contact-card-1')).toBeTruthy();
      expect(screen.getByTestId('contact-card-2')).toBeTruthy();
      expect(screen.getByTestId('contact-card-3')).toBeTruthy();
    });

    expect(mockFetchContacts).toHaveBeenCalledTimes(1);
  });

  it('should render zero state when no contacts are available', () => {
    useContactsStore.mockReturnValue({
      contacts: [],
      searchQuery: '',
      setSearchQuery: jest.fn(),
      selectContact: jest.fn(),
      isLoading: false,
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    expect(screen.getByText('ZeroState: contacts.empty')).toBeTruthy();
  });

  it('should filter contacts based on search query', async () => {
    const mockSetSearchQuery = jest.fn();

    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: 'john',
      setSearchQuery: mockSetSearchQuery,
      selectContact: jest.fn(),
      isLoading: false,
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    // Only John Doe should be visible in filtered results
    await waitFor(() => {
      expect(screen.getByTestId('contact-card-1')).toBeTruthy();
      expect(screen.queryByTestId('contact-card-2')).toBeFalsy();
      expect(screen.queryByTestId('contact-card-3')).toBeFalsy();
    });
  });

  it('should show zero state when search returns no results', () => {
    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: 'nonexistent',
      setSearchQuery: jest.fn(),
      selectContact: jest.fn(),
      isLoading: false,
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    expect(screen.getByText('ZeroState: contacts.empty')).toBeTruthy();
  });

  it('should handle search input changes', async () => {
    const mockSetSearchQuery = jest.fn();

    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: '',
      setSearchQuery: mockSetSearchQuery,
      selectContact: jest.fn(),
      isLoading: false,
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    const searchInput = screen.getByPlaceholderText('contacts.search');
    fireEvent.changeText(searchInput, 'john');

    expect(mockSetSearchQuery).toHaveBeenCalledWith('john');
  });

  it('should clear search query when X button is pressed', async () => {
    const mockSetSearchQuery = jest.fn();

    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: 'john',
      setSearchQuery: mockSetSearchQuery,
      selectContact: jest.fn(),
      isLoading: false,
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    const clearButton = screen.getByTestId('clear-search-button');
    fireEvent.press(clearButton);

    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
  });

  it('should handle contact selection', async () => {
    const mockSelectContact = jest.fn();

    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: '',
      setSearchQuery: jest.fn(),
      selectContact: mockSelectContact,
      isLoading: false,
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    const contactCard = screen.getByTestId('contact-card-1');
    fireEvent.press(contactCard);

    expect(mockSelectContact).toHaveBeenCalledWith('1');
  });

  it('should handle refresh functionality', async () => {
    const mockFetchContacts = jest.fn();

    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: '',
      setSearchQuery: jest.fn(),
      selectContact: jest.fn(),
      isLoading: false,
      fetchContacts: mockFetchContacts,
    });

    render(<Contacts />);

    const flatList = screen.getByTestId('contacts-list');
    fireEvent(flatList, 'refresh');

    await waitFor(() => {
      expect(mockFetchContacts).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
    });
  });

  it('should not show loading when contacts are already loaded during refresh', () => {
    useContactsStore.mockReturnValue({
      contacts: mockContacts,
      searchQuery: '',
      setSearchQuery: jest.fn(),
      selectContact: jest.fn(),
      isLoading: true, // Loading is true but contacts exist
      fetchContacts: jest.fn(),
    });

    render(<Contacts />);

    // Should not show loading page since contacts are already loaded
    expect(screen.queryByText('Loading')).toBeFalsy();
    expect(screen.getByTestId('contact-card-1')).toBeTruthy();
  });
}); 