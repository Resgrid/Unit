jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((specifics: any) => specifics.ios || specifics.default),
    Version: 17,
  },
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  })),
}));

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { deleteCallVideoFeed, editCallVideoFeed, getCallVideoFeeds, saveCallVideoFeed } from '@/api/call-video-feeds/call-video-feeds';
import { useCallVideoFeedStore } from '../store';

jest.mock('@/api/call-video-feeds/call-video-feeds');
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetCallVideoFeeds = getCallVideoFeeds as jest.MockedFunction<typeof getCallVideoFeeds>;
const mockSaveCallVideoFeed = saveCallVideoFeed as jest.MockedFunction<typeof saveCallVideoFeed>;
const mockEditCallVideoFeed = editCallVideoFeed as jest.MockedFunction<typeof editCallVideoFeed>;
const mockDeleteCallVideoFeed = deleteCallVideoFeed as jest.MockedFunction<typeof deleteCallVideoFeed>;

const emptyResult = { PageSize: 0, Timestamp: '', Version: '', Node: '', RequestId: '', Status: '', Environment: '' };

describe('useCallVideoFeedStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCallVideoFeedStore.getState().reset();
  });

  it('should have correct initial state', () => {
    const state = useCallVideoFeedStore.getState();
    expect(state.feeds).toEqual([]);
    expect(state.isLoadingFeeds).toBe(false);
    expect(state.isSaving).toBe(false);
    expect(state.isDeleting).toBe(false);
    expect(state.feedsError).toBeNull();
    expect(state.saveError).toBeNull();
  });

  describe('fetchFeeds', () => {
    it('should fetch and sort feeds by SortOrder', async () => {
      const mockData = [
        { CallVideoFeedId: '2', Name: 'Feed B', SortOrder: 2, CallId: '1', Url: '', FeedType: 0, FeedFormat: 0, Description: '', Status: 0, Latitude: '', Longitude: '', AddedByUserId: '', AddedOnFormatted: '', AddedOnUtc: '', FullName: '' },
        { CallVideoFeedId: '1', Name: 'Feed A', SortOrder: 1, CallId: '1', Url: '', FeedType: 0, FeedFormat: 0, Description: '', Status: 0, Latitude: '', Longitude: '', AddedByUserId: '', AddedOnFormatted: '', AddedOnUtc: '', FullName: '' },
      ];

      mockGetCallVideoFeeds.mockResolvedValue({ ...emptyResult, Data: mockData });

      const { result } = renderHook(() => useCallVideoFeedStore());

      await act(async () => {
        await result.current.fetchFeeds(1);
      });

      await waitFor(() => {
        expect(result.current.feeds).toHaveLength(2);
        expect(result.current.feeds[0].Name).toBe('Feed A');
        expect(result.current.feeds[1].Name).toBe('Feed B');
        expect(result.current.isLoadingFeeds).toBe(false);
      });
    });

    it('should handle fetch errors', async () => {
      mockGetCallVideoFeeds.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCallVideoFeedStore());

      await act(async () => {
        await result.current.fetchFeeds(1);
      });

      await waitFor(() => {
        expect(result.current.feedsError).toBe('Network error');
        expect(result.current.isLoadingFeeds).toBe(false);
      });
    });
  });

  describe('saveFeed', () => {
    it('should save feed and re-fetch', async () => {
      mockSaveCallVideoFeed.mockResolvedValue({ ...emptyResult, Id: 'new-id' });
      mockGetCallVideoFeeds.mockResolvedValue({ ...emptyResult, Data: [] });

      const { result } = renderHook(() => useCallVideoFeedStore());

      let success = false;
      await act(async () => {
        success = await result.current.saveFeed({ CallId: 1, Name: 'Test', Url: 'https://example.com/stream.m3u8' });
      });

      expect(success).toBe(true);
      expect(mockSaveCallVideoFeed).toHaveBeenCalled();
      expect(result.current.isSaving).toBe(false);
    });

    it('should handle save errors', async () => {
      mockSaveCallVideoFeed.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useCallVideoFeedStore());

      let success = true;
      await act(async () => {
        success = await result.current.saveFeed({ CallId: 1, Name: 'Test', Url: 'https://example.com' });
      });

      expect(success).toBe(false);
      expect(result.current.saveError).toBe('Save failed');
    });
  });

  describe('editFeed', () => {
    it('should edit feed and re-fetch', async () => {
      mockEditCallVideoFeed.mockResolvedValue({ ...emptyResult, Id: 'feed-1' });
      mockGetCallVideoFeeds.mockResolvedValue({ ...emptyResult, Data: [] });

      const { result } = renderHook(() => useCallVideoFeedStore());

      let success = false;
      await act(async () => {
        success = await result.current.editFeed({ CallVideoFeedId: 'feed-1', CallId: 1, Name: 'Updated', Url: 'https://example.com' });
      });

      expect(success).toBe(true);
      expect(mockEditCallVideoFeed).toHaveBeenCalled();
    });
  });

  describe('deleteFeed', () => {
    it('should delete feed and re-fetch', async () => {
      mockDeleteCallVideoFeed.mockResolvedValue({ ...emptyResult, Id: 'feed-1' });
      mockGetCallVideoFeeds.mockResolvedValue({ ...emptyResult, Data: [] });

      const { result } = renderHook(() => useCallVideoFeedStore());

      let success = false;
      await act(async () => {
        success = await result.current.deleteFeed('feed-1', 1);
      });

      expect(success).toBe(true);
      expect(mockDeleteCallVideoFeed).toHaveBeenCalledWith('feed-1');
      expect(result.current.isDeleting).toBe(false);
    });

    it('should handle delete errors', async () => {
      mockDeleteCallVideoFeed.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useCallVideoFeedStore());

      let success = true;
      await act(async () => {
        success = await result.current.deleteFeed('feed-1', 1);
      });

      expect(success).toBe(false);
      expect(result.current.isDeleting).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset state to initial values', () => {
      useCallVideoFeedStore.setState({
        feeds: [{ CallVideoFeedId: '1', Name: 'Test' }] as any,
        isLoadingFeeds: true,
        feedsError: 'some error',
      });

      const { result } = renderHook(() => useCallVideoFeedStore());

      act(() => {
        result.current.reset();
      });

      expect(result.current.feeds).toEqual([]);
      expect(result.current.isLoadingFeeds).toBe(false);
      expect(result.current.feedsError).toBeNull();
    });
  });
});
