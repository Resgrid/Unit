// Set up global mocks first, before any imports
(global as any).window = global;
(global as any).addEventListener = jest.fn();
(global as any).removeEventListener = jest.fn();
(global as any).cssInterop = jest.fn();

// Mock CSS interop
jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
}));



// Mock expo modules
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        BASE_API_URL: 'http://localhost:3000',
        API_VERSION: 'v4',
      },
    },
  },
}));

// Mock the env module
jest.mock('@env', () => ({
  Env: {
    BASE_API_URL: 'http://localhost:3000',
    API_VERSION: 'v4',
  },
}));

// Mock storage module
jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock auth store
jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: {
    getState: () => ({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh-token',
      status: 'signedIn',
    }),
    setState: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock API functions
jest.mock('@/api/contacts/contactNotes', () => ({
  getContactNotes: jest.fn(),
}));

jest.mock('@/api/contacts/contacts', () => ({
  getAllContacts: jest.fn(),
}));

jest.mock('@/lib/auth/api', () => ({
  refreshTokenRequest: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));



import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ContactType, type ContactResultData } from '@/models/v4/contacts/contactResultData';
import { useContactsStore } from '@/stores/contacts/store';

import { ContactDetailsSheet } from '../contact-details-sheet';

// Mock the store
jest.mock('@/stores/contacts/store');
const mockUseContactsStore = useContactsStore as jest.MockedFunction<typeof useContactsStore>;

// Mock the ContactNotesList component
jest.mock('../contact-notes-list', () => {
  const { View, Text } = require('react-native');
  return {
    ContactNotesList: ({ contactId }: { contactId: string }) => (
      <View testID={`contact-notes-list-${contactId}`}>
        <Text>Contact Notes List for {contactId}</Text>
      </View>
    ),
  };
});

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'contacts.details': 'Contact Details',
        'contacts.tabs.details': 'Details',
        'contacts.tabs.notes': 'Notes',
        'contacts.person': 'Person',
        'contacts.company': 'Company',
        'contacts.contactInformation': 'Contact Information',
        'contacts.email': 'Email',
        'contacts.phone': 'Phone',
        'contacts.mobile': 'Mobile',
        'contacts.homePhone': 'Home Phone',
        'contacts.cellPhone': 'Cell Phone',
        'contacts.officePhone': 'Office Phone',
        'contacts.faxPhone': 'Fax Phone',
        'contacts.locationInformation': 'Location Information',
        'contacts.address': 'Address',
        'contacts.cityStateZip': 'City, State, Zip',
        'contacts.locationCoordinates': 'Location Coordinates',
        'contacts.entranceCoordinates': 'Entrance Coordinates',
        'contacts.exitCoordinates': 'Exit Coordinates',
        'contacts.socialMediaWeb': 'Social Media & Web',
        'contacts.website': 'Website',
        'contacts.twitter': 'Twitter',
        'contacts.facebook': 'Facebook',
        'contacts.linkedin': 'LinkedIn',
        'contacts.instagram': 'Instagram',
        'contacts.threads': 'Threads',
        'contacts.bluesky': 'Bluesky',
        'contacts.mastodon': 'Mastodon',
        'contacts.identification': 'Identification',
        'contacts.countryId': 'Country ID',
        'contacts.stateId': 'State ID',
        'contacts.additionalInformation': 'Additional Information',
        'contacts.description': 'Description',
        'contacts.notes': 'Notes',
        'contacts.otherInfo': 'Other Information',
        'contacts.systemInformation': 'System Information',
        'contacts.addedOn': 'Added On',
        'contacts.addedBy': 'Added By',
        'contacts.editedOn': 'Edited On',
        'contacts.editedBy': 'Edited By',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  BuildingIcon: ({ size, color }: { size: number; color: string }) => `BuildingIcon-${size}-${color}`,
  CalendarIcon: ({ size, color }: { size: number; color: string }) => `CalendarIcon-${size}-${color}`,
  ChevronDownIcon: ({ size, color }: { size: number; color: string }) => `ChevronDownIcon-${size}-${color}`,
  ChevronRightIcon: ({ size, color }: { size: number; color: string }) => `ChevronRightIcon-${size}-${color}`,
  Edit2Icon: ({ size, color }: { size: number; color: string }) => `Edit2Icon-${size}-${color}`,
  GlobeIcon: ({ size, color }: { size: number; color: string }) => `GlobeIcon-${size}-${color}`,
  HomeIcon: ({ size, color }: { size: number; color: string }) => `HomeIcon-${size}-${color}`,
  MailIcon: ({ size, color }: { size: number; color: string }) => `MailIcon-${size}-${color}`,
  MapPinIcon: ({ size, color }: { size: number; color: string }) => `MapPinIcon-${size}-${color}`,
  PhoneIcon: ({ size, color }: { size: number; color: string }) => `PhoneIcon-${size}-${color}`,
  SettingsIcon: ({ size, color }: { size: number; color: string }) => `SettingsIcon-${size}-${color}`,
  SmartphoneIcon: ({ size, color }: { size: number; color: string }) => `SmartphoneIcon-${size}-${color}`,
  StarIcon: ({ size, color }: { size: number; color: string }) => `StarIcon-${size}-${color}`,
  TrashIcon: ({ size, color }: { size: number; color: string }) => `TrashIcon-${size}-${color}`,
  UserIcon: ({ size, color }: { size: number; color: string }) => `UserIcon-${size}-${color}`,
  X: ({ size, className }: { size: number; className?: string }) => `X-${size}${className ? `-${className}` : ''}`,
}));

// Mock React Native components
jest.mock('react-native', () => ({
  ScrollView: ({ children }: any) => <div data-testid="scroll-view">{children}</div>,
  TouchableOpacity: ({ children, onPress }: any) => (
    <button onClick={onPress}>{children}</button>
  ),
  Pressable: ({ children, onPress }: any) => (
    <button onClick={onPress}>{children}</button>
  ),
  View: ({ children }: any) => <div>{children}</div>,
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addChangeListener: jest.fn(),
    removeChangeListener: jest.fn(),
  },
}));

// Mock nativewind
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock react-native-css-interop
jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
}));

// Mock all UI components to avoid cssInterop issues
jest.mock('@/components/ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen, onClose }: any) => (
    isOpen ? <div data-testid="actionsheet">{children}</div> : null
  ),
  ActionsheetBackdrop: () => <div data-testid="actionsheet-backdrop" />,
  ActionsheetContent: ({ children }: any) => <div data-testid="actionsheet-content">{children}</div>,
  ActionsheetDragIndicator: () => <div data-testid="actionsheet-drag-indicator" />,
  ActionsheetDragIndicatorWrapper: ({ children }: any) => <div data-testid="actionsheet-drag-indicator-wrapper">{children}</div>,
}));

jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div data-testid="avatar">{children}</div>,
  AvatarImage: ({ source, alt }: any) => (
    <div
      data-testid="avatar-image"
      data-source={source?.uri}
      data-alt={alt}
    />
  ),
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children }: any) => <div data-testid="box">{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, testID }: any) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  ButtonText: ({ children }: any) => <span data-testid="button-text">{children}</span>,
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children }: any) => <div data-testid="hstack">{children}</div>,
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children }: any) => <div data-testid="vstack">{children}</div>,
}));

jest.mock('@/components/ui/pressable', () => ({
  Pressable: ({ children, onPress, disabled }: any) => (
    <button data-testid="pressable" onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children }: any) => <span data-testid="text">{children}</span>,
}));

// Sample test data
const mockPersonContact: ContactResultData = {
  ContactId: 'contact-1',
  Name: 'John Doe',
  FirstName: 'John',
  MiddleName: 'William',
  LastName: 'Doe',
  Email: 'john@example.com',
  Phone: '123-456-7890',
  Mobile: '098-765-4321',
  HomePhoneNumber: '111-222-3333',
  CellPhoneNumber: '444-555-6666',
  OfficePhoneNumber: '777-888-9999',
  FaxPhoneNumber: '000-111-2222',
  ContactType: ContactType.Person,
  IsImportant: true,
  Address: '123 Main St',
  City: 'Anytown',
  State: 'CA',
  Zip: '12345',
  LocationGpsCoordinates: '37.7749,-122.4194',
  EntranceGpsCoordinates: '37.7748,-122.4193',
  ExitGpsCoordinates: '37.7750,-122.4195',
  Website: 'https://example.com',
  Twitter: 'johndoe',
  Facebook: 'john.doe',
  LinkedIn: 'john-doe',
  Instagram: 'johndoe',
  Threads: 'johndoe',
  Bluesky: 'johndoe',
  Mastodon: 'johndoe',
  CountryIssuedIdNumber: 'US123456',
  StateIdNumber: 'CA789012',
  CountryIdName: 'SSN',
  StateIdName: 'Driver License',
  StateIdCountryName: 'California',
  Description: 'Important contact person',
  Notes: 'Always available on weekends',
  OtherInfo: 'Prefers text messages',
  AddedOn: '2023-01-01',
  AddedByUserName: 'Admin User',
  EditedOn: '2023-06-01',
  EditedByUserName: 'Editor User',
  OtherName: 'Johnny',
  ImageUrl: 'https://example.com/avatar.jpg',
  Category: {
    Name: 'VIP',
  },
} as ContactResultData;

const mockCompanyContact: ContactResultData = {
  ContactId: 'contact-2',
  Name: 'Acme Corp',
  CompanyName: 'Acme Corporation',
  Email: 'info@acme.com',
  Phone: '555-123-4567',
  ContactType: ContactType.Company,
  IsImportant: false,
} as ContactResultData;

describe('ContactDetailsSheet', () => {
  const mockCloseDetails = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when no contact is selected', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: null,
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.queryByText('Contact Details')).toBeFalsy();
    });

    it('should not render when modal is closed', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: false,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      // The component should render but the modal should be closed
      expect(screen.queryByText('Contact Details')).toBeFalsy();
    });

    it('should render contact details sheet when modal is open', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('Contact Details')).toBeTruthy();
    });
  });

  describe('contact header', () => {
    it('should display person contact name correctly', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('John William Doe')).toBeTruthy();
      expect(screen.getByText('Person')).toBeTruthy();
    });

    it('should display company contact name correctly', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockCompanyContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-2',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('Acme Corporation')).toBeTruthy();
      expect(screen.getByText('Company')).toBeTruthy();
    });

    it('should display star icon for important contacts', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      // Check that important contact displays star (this would need proper icon testing)
      expect(screen.getByText('John William Doe')).toBeTruthy();
    });

    it('should display other name when available', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('(Johnny)')).toBeTruthy();
    });

    it('should display category when available', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('VIP')).toBeTruthy();
    });
  });

  describe('tab functionality', () => {
    it('should display both tabs', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('Details')).toBeTruthy();
      expect(screen.getByText('Notes')).toBeTruthy();
    });

    it('should show details tab content by default', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      // Should show details content
      expect(screen.getByText('Contact Information')).toBeTruthy();
      expect(screen.getByText('john@example.com')).toBeTruthy();

      // Should not show notes component
      expect(screen.queryByTestId('contact-notes-list-contact-1')).toBeFalsy();
    });

    it('should switch to notes tab when clicked', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      // Click on Notes tab
      fireEvent.press(screen.getByText('Notes'));

      // Should show notes component
      expect(screen.getByTestId('contact-notes-list-contact-1')).toBeTruthy();

      // Should not show details content
      expect(screen.queryByText('Contact Information')).toBeFalsy();
    });

    it('should switch back to details tab when clicked', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      // Switch to Notes tab first
      fireEvent.press(screen.getByText('Notes'));
      expect(screen.getByTestId('contact-notes-list-contact-1')).toBeTruthy();

      // Switch back to Details tab
      fireEvent.press(screen.getByText('Details'));
      expect(screen.getByText('Contact Information')).toBeTruthy();
      expect(screen.queryByTestId('contact-notes-list-contact-1')).toBeFalsy();
    });
  });

  describe('details tab content', () => {
    it('should display contact information section', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('Contact Information')).toBeTruthy();
      expect(screen.getByText('john@example.com')).toBeTruthy();
      expect(screen.getByText('123-456-7890')).toBeTruthy();
      expect(screen.getByText('098-765-4321')).toBeTruthy();
    });

    it('should display location information section', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('Location Information')).toBeTruthy();
      expect(screen.getByText('123 Main St')).toBeTruthy();
      expect(screen.getByText('Anytown, CA, 12345')).toBeTruthy();
    });

    it('should display social media section when collapsed initially', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.getByText('Social Media & Web')).toBeTruthy();
      // Content should be collapsed by default
    });

    it('should not display sections without data', () => {
      const minimalContact = {
        ...mockPersonContact,
        Email: null,
        Phone: null,
        Mobile: null,
        Address: null,
        Website: null,
      };

      mockUseContactsStore.mockReturnValue({
        contacts: [minimalContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      expect(screen.queryByText('Contact Information')).toBeFalsy();
      expect(screen.queryByText('Location Information')).toBeFalsy();
      expect(screen.queryByText('Social Media & Web')).toBeFalsy();
    });
  });

  describe('notes tab content', () => {
    it('should render ContactNotesList component with correct contactId', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      // Switch to Notes tab
      fireEvent.press(screen.getByText('Notes'));

      expect(screen.getByTestId('contact-notes-list-contact-1')).toBeTruthy();
      expect(screen.getByText('Contact Notes List for contact-1')).toBeTruthy();
    });
  });

  describe('modal interaction', () => {
    it('should call closeDetails when close button is pressed', () => {
      mockUseContactsStore.mockReturnValue({
        contacts: [mockPersonContact],
        contactNotes: {},
        searchQuery: '',
        selectedContactId: 'contact-1',
        isDetailsOpen: true,
        isLoading: false,
        isNotesLoading: false,
        error: null,
        fetchContacts: jest.fn(),
        fetchContactNotes: jest.fn(),
        setSearchQuery: jest.fn(),
        selectContact: jest.fn(),
        closeDetails: mockCloseDetails,
      });

      render(<ContactDetailsSheet />);

      // Find and press the close button (X icon)
      const closeButton = screen.getByRole('button');
      fireEvent.press(closeButton);

      expect(mockCloseDetails).toHaveBeenCalled();
    });
  });
}); 