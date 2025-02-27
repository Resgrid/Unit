import { create } from 'zustand';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

interface NotesState {
  notes: Note[];
  searchQuery: string;
  selectedNoteId: string | null;
  isDetailsOpen: boolean;

  // Actions
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (
    id: string,
    note: Partial<Omit<Note, 'id' | 'createdAt'>>
  ) => void;
  deleteNote: (id: string) => void;
  setSearchQuery: (query: string) => void;
  selectNote: (id: string) => void;
  closeDetails: () => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [
    {
      id: '1',
      title: 'Meeting with Client',
      content: 'Discuss project timeline and requirements',
      createdAt: new Date('2023-10-15'),
      updatedAt: new Date('2023-10-15'),
      tags: ['work', 'client'],
    },
    {
      id: '2',
      title: 'Shopping List',
      content: 'Milk, eggs, bread, fruits',
      createdAt: new Date('2023-10-16'),
      updatedAt: new Date('2023-10-16'),
      tags: ['personal'],
    },
    {
      id: '3',
      title: 'Book Recommendations',
      content: 'Atomic Habits, Deep Work, The Psychology of Money',
      createdAt: new Date('2023-10-17'),
      updatedAt: new Date('2023-10-18'),
      tags: ['reading', 'personal'],
    },
  ],
  searchQuery: '',
  selectedNoteId: null,
  isDetailsOpen: false,

  addNote: (note) =>
    set((state) => {
      const newNote: Note = {
        ...note,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return { notes: [...state.notes, newNote] };
    }),

  updateNote: (id, updatedNote) =>
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id
          ? { ...note, ...updatedNote, updatedAt: new Date() }
          : note
      ),
    })),

  deleteNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== id),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  selectNote: (id) => set({ selectedNoteId: id, isDetailsOpen: true }),

  closeDetails: () => set({ isDetailsOpen: false }),
}));
