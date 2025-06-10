import { create } from 'zustand';

import { getAllContacts } from '@/api/contacts/contacts';
import { type ContactResultData } from '@/models/v4/contacts/contactResultData';

interface ContactsState {
  contacts: ContactResultData[];
  searchQuery: string;
  selectedContactId: string | null;
  isDetailsOpen: boolean;
  isLoading: boolean;
  error: string | null;
  // Actions
  fetchContacts: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  selectContact: (id: string) => void;
  closeDetails: () => void;
}

export const useContactsStore = create<ContactsState>((set, _get) => ({
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

  setSearchQuery: (query) => set({ searchQuery: query }),

  selectContact: (id) => set({ selectedContactId: id, isDetailsOpen: true }),

  closeDetails: () => set({ isDetailsOpen: false }),
}));
