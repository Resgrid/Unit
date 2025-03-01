import { create } from 'zustand';
import { getCall, getCallExtraData } from '@/api/calls/calls';
import { CallResultData } from '@/models/v4/calls/callResultData';
import { CallExtraDataResultData } from '@/models/v4/calls/callExtraDataResultData';
import { CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { useCallsStore } from './store';
import { CallNoteResultData } from '@/models/v4/callNotes/callNoteResultData';
//import { getCallNotes, saveCallNote } from '@/api/calls/callNotes';

interface CallImage {
  id: string;
  url: string;
  name: string;
  timestamp: string;
}

interface CallDetailState {
  call: CallResultData | null;
  callExtraData: CallExtraDataResultData | null;
  callPriority: CallPriorityResultData | null;
  callNotes: CallNoteResultData[];
  isLoading: boolean;
  error: string | null;
  isNotesLoading: boolean;
  fetchCallDetail: (callId: string) => Promise<void>;
  reset: () => void;
  fetchCallNotes: (callId: string) => Promise<void>;
  addNote: (callId: string, note: string, userId: string, latitude: number | null, longitude: number | null) => Promise<void>;
  searchNotes: (query: string) => CallNoteResultData[];
  callImages: CallImage[] | null;
  isLoadingImages: boolean;
  errorImages: string | null;
  fetchCallImages: (callId: string) => Promise<void>;
  uploadCallImage: (callId: string, imageUri: string, name: string) => Promise<void>;
}

export const useCallDetailStore = create<CallDetailState>((set) => ({
  call: null,
  callExtraData: null,
  callPriority: null,
  callNotes: [],
  isLoading: false,
  error: null,
  isNotesLoading: false,
  callImages: null,
  isLoadingImages: false,
  errorImages: null,
  reset: () =>
    set({ call: null, callExtraData: null, callPriority: null, isLoading: false, isNotesLoading: false, error: null }),
  fetchCallDetail: async (callId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [callResult, callExtraDataResult] = await Promise.all([
        getCall(callId),
        getCallExtraData(callId),
      ]);

      if (
        callResult &&
        callResult.Data &&
        callExtraDataResult &&
        callExtraDataResult.Data
      ) {
        const callPriority = useCallsStore.getState().callPriorities.find(
          (priority) => priority.Id === callResult.Data.Priority
        );

        set({
          call: callResult.Data,
          callExtraData: callExtraDataResult.Data,
          callPriority: callPriority || null,
          isLoading: false,
        });
      } else {
        set({
          error:
            callResult.Message ||
            callExtraDataResult.Message ||
            'Failed to fetch call details',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
        isLoading: false,
      });
    }
  },
  fetchCallNotes: async (callId: string) => {
    set({ isNotesLoading: true });
    /*try {
      const callNotes = await getCallNotes(callId);
      set({ 
        callNotes: callNotes.Data || [], 
        isNotesLoading: false 
      });
    } catch (error) {
      set({ 
        callNotes: [], 
        isNotesLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch call notes'
      });
    }*/
  },
  addNote: async (callId: string, note: string, userId: string, latitude: number | null, longitude: number | null) => {
    set({ isNotesLoading: true });
    /*try {
      await saveCallNote(callId, userId, note, latitude, longitude);
      await useCallDetailStore.getState().fetchCallNotes(callId);
    } catch (error) {
      set({ 
        isNotesLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add note'
      });
    }*/
  },
  searchNotes: (query: string): CallNoteResultData[] => {
    const callNotes = useCallDetailStore.getState().callNotes;
    if (!query) return callNotes;
    return callNotes?.filter((note: CallNoteResultData) =>  
      note.Note.toLowerCase().includes(query.toLowerCase()) ||
      note.FullName.toLowerCase().includes(query.toLowerCase())
    );
  },
  fetchCallImages: async (callId: string) => {
    set({ isLoadingImages: true, errorImages: null });
    try {
      // Replace with your actual API call
      // This is a mock implementation
      const response = await new Promise<CallImage[]>((resolve) => {
        setTimeout(() => {
          resolve([
            {
              id: '1',
              url: 'https://picsum.photos/id/237/500/500',
              name: 'Scene photo 1',
              timestamp: new Date().toISOString(),
            },
            {
              id: '2',
              url: 'https://picsum.photos/id/238/500/500',
              name: 'Evidence photo',
              timestamp: new Date().toISOString(),
            },
            {
              id: '3',
              url: 'https://picsum.photos/id/239/500/500',
              name: 'Location overview',
              timestamp: new Date().toISOString(),
            },
          ]);
        }, 1000);
      });
      
      set({ callImages: response, isLoadingImages: false });
    } catch (error) {
      console.error('Error fetching call images:', error);
      set({ 
        errorImages: error instanceof Error ? error.message : 'Failed to load images', 
        isLoadingImages: false 
      });
    }
  },
  uploadCallImage: async (callId: string, imageUri: string, name: string) => {
    try {
      // Replace with your actual API call
      // This is a mock implementation
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1500);
      });
      
      // After successful upload, refresh the images list
      useCallDetailStore.getState().fetchCallImages(callId);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },
}));