import { create } from 'zustand';

import { deleteContact, getAllContacts, saveContact } from '@/api/contacts/contacts';
import { type ContactResultData } from '@/models/v4/contacts/contactResultData';
import { type SaveContactInput } from '@/models/v4/contacts/saveContactInput';

interface ContactsState {
  contacts: ContactResultData[];
  searchQuery: string;
  selectedContactId: string | null;
  isDetailsOpen: boolean;
  isLoading: boolean;
  error: string | null;
  // Actions
  fetchContacts: () => Promise<void>;
  updateContact: (id: string, contact: Partial<Omit<SaveContactInput, 'contactId'>>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  selectContact: (id: string) => void;
  closeDetails: () => void;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  searchQuery: '',
  selectedContactId: null,
  isDetailsOpen: false,
  isLoading: false,
  error: null,

  fetchContacts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getAllContacts();
      set({ contacts: response.Data, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
  },

  updateContact: async (id, updatedContact) => {
    try {
      // Find the existing contact to get the required fields
      const existingContact = get().contacts.find((contact) => contact.ContactId === id);

      if (!existingContact) {
        throw new Error('Contact not found');
      }

      const contactData: SaveContactInput = {
        contactId: id,
        name: updatedContact.name ?? existingContact.Name,
        type: updatedContact.type ?? existingContact.Type,
        isImportant: updatedContact.isImportant ?? existingContact.IsImportant,
        email: updatedContact.email,
        phone: updatedContact.phone,
        mobile: updatedContact.mobile,
        address: updatedContact.address,
        city: updatedContact.city,
        state: updatedContact.state,
        zip: updatedContact.zip,
        notes: updatedContact.notes,
        imageUrl: updatedContact.imageUrl,
      };

      await saveContact(contactData);

      set((state) => ({
        contacts: state.contacts.map((contact) => (contact.ContactId === id ? { ...contact, ...updatedContact, UpdatedOn: new Date() } : contact)),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
  },

  removeContact: async (id) => {
    try {
      await deleteContact(id);
      set((state) => ({
        contacts: state.contacts.filter((contact) => contact.ContactId !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  selectContact: (id) => set({ selectedContactId: id, isDetailsOpen: true }),

  closeDetails: () => set({ isDetailsOpen: false }),
}));
