import { create } from 'zustand';

import { deleteCallVideoFeed, editCallVideoFeed, type EditCallVideoFeedInput, getCallVideoFeeds, saveCallVideoFeed, type SaveCallVideoFeedInput } from '@/api/call-video-feeds/call-video-feeds';
import { logger } from '@/lib/logging';
import type { CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';

interface CallVideoFeedState {
  feeds: CallVideoFeedResultData[];
  isLoadingFeeds: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  feedsError: string | null;
  saveError: string | null;

  fetchFeeds: (callId: number) => Promise<void>;
  saveFeed: (input: SaveCallVideoFeedInput) => Promise<boolean>;
  editFeed: (input: EditCallVideoFeedInput) => Promise<boolean>;
  deleteFeed: (feedId: string, callId: number) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  feeds: [],
  isLoadingFeeds: false,
  isSaving: false,
  isDeleting: false,
  feedsError: null,
  saveError: null,
};

export const useCallVideoFeedStore = create<CallVideoFeedState>((set, get) => ({
  ...initialState,

  fetchFeeds: async (callId: number) => {
    set({ isLoadingFeeds: true, feedsError: null });
    try {
      const result = await getCallVideoFeeds(callId);
      const sorted = [...result.Data].sort((a, b) => a.SortOrder - b.SortOrder);
      set({ feeds: sorted, isLoadingFeeds: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch video feeds';
      logger.error({ message: 'Failed to fetch video feeds', context: { error, callId } });
      set({ feedsError: message, isLoadingFeeds: false });
    }
  },

  saveFeed: async (input: SaveCallVideoFeedInput) => {
    set({ isSaving: true, saveError: null });
    try {
      await saveCallVideoFeed(input);
      set({ isSaving: false });
      get().fetchFeeds(input.CallId);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save video feed';
      logger.error({ message: 'Failed to save video feed', context: { error, input } });
      set({ saveError: message, isSaving: false });
      return false;
    }
  },

  editFeed: async (input: EditCallVideoFeedInput) => {
    set({ isSaving: true, saveError: null });
    try {
      await editCallVideoFeed(input);
      set({ isSaving: false });
      get().fetchFeeds(input.CallId);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to edit video feed';
      logger.error({ message: 'Failed to edit video feed', context: { error, input } });
      set({ saveError: message, isSaving: false });
      return false;
    }
  },

  deleteFeed: async (feedId: string, callId: number) => {
    set({ isDeleting: true });
    try {
      await deleteCallVideoFeed(feedId);
      set({ isDeleting: false });
      get().fetchFeeds(callId);
      return true;
    } catch (error) {
      logger.error({ message: 'Failed to delete video feed', context: { error, feedId } });
      set({ isDeleting: false });
      return false;
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));
