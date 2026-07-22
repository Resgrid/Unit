// Mock Platform first before any imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((specifics: any) => specifics.ios || specifics.default),
    Version: 17,
  },
}));

// Mock MMKV storage
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  })),
  useMMKVBoolean: jest.fn(() => [false, jest.fn()]),
}));

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getResourceIncidentView } from '@/api/calls/incidentCommand';
import { useCoreStore } from '@/stores/app/core-store';

import { useIncidentCommandStore } from '../incident-command-store';

// Mock the API calls
jest.mock('@/api/calls/incidentCommand');

// Mock the core store so no real storage/config dependencies load
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: jest.fn(),
  },
}));

const mockGetResourceIncidentView = getResourceIncidentView as jest.MockedFunction<typeof getResourceIncidentView>;
const mockGetCoreState = useCoreStore.getState as jest.MockedFunction<typeof useCoreStore.getState>;

const createMockView = () => ({
  IncidentCommandId: 'ic-1',
  CallId: 123,
  Status: 0,
  EstablishedOn: '2026-07-01T10:00:00Z',
  EstimatedEndOn: null,
  ClosedOn: null,
  ImportantInformation: 'Watch for downed lines',
  IncidentActionPlan: 'Attack from the north side',
  Commander: { UserId: 'user-1', Name: 'Chief Smith', Phone: '555-1234', Email: 'chief@example.com' },
  Objectives: [],
  Needs: [],
  Notes: [],
  Attachments: [],
  MyAssignment: null,
});

describe('useIncidentCommandStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useIncidentCommandStore.setState({
      view: null,
      isLoading: false,
      error: null,
    });
    mockGetCoreState.mockReturnValue({ activeUnitId: '42' } as any);
  });

  describe('fetchIncidentView', () => {
    it('should fetch the incident view successfully and pass the active unit id', async () => {
      const mockView = createMockView();
      mockGetResourceIncidentView.mockResolvedValue({
        Data: mockView,
        Status: 'Ok',
      } as any);

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      // Verify initial state
      expect(result.current.view).toBeNull();
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.fetchIncidentView('call123');
      });

      await waitFor(() => {
        expect(result.current.view).toEqual(mockView);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(mockGetResourceIncidentView).toHaveBeenCalledWith('call123', '42');

      unmount();
    });

    it('should call the endpoint without a unit id when there is no active unit', async () => {
      mockGetCoreState.mockReturnValue({ activeUnitId: null } as any);
      mockGetResourceIncidentView.mockResolvedValue({
        Data: createMockView(),
        Status: 'Ok',
      } as any);

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      await act(async () => {
        await result.current.fetchIncidentView('call123');
      });

      expect(mockGetResourceIncidentView).toHaveBeenCalledWith('call123', undefined);

      unmount();
    });

    it('should handle loading state correctly', async () => {
      mockGetResourceIncidentView.mockImplementation(() => new Promise(() => {}));

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      act(() => {
        result.current.fetchIncidentView('call123');
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.view).toBeNull();

      unmount();
    });

    it('should set an empty view when the call has no incident command (NotFound)', async () => {
      mockGetResourceIncidentView.mockResolvedValue({
        Data: null,
        Status: 'NotFound',
      } as any);

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      await act(async () => {
        await result.current.fetchIncidentView('call123');
      });

      await waitFor(() => {
        expect(result.current.view).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      unmount();
    });

    it('should handle fetch errors', async () => {
      const errorMessage = 'Network error';
      mockGetResourceIncidentView.mockRejectedValue(new Error(errorMessage));

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      await act(async () => {
        await result.current.fetchIncidentView('call123');
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.view).toBeNull();
      });

      expect(mockGetResourceIncidentView).toHaveBeenCalledWith('call123', '42');

      unmount();
    });

    it('should clear a previous error when refetching', async () => {
      useIncidentCommandStore.setState({ error: 'Previous error' });

      const mockView = createMockView();
      mockGetResourceIncidentView.mockResolvedValue({
        Data: mockView,
        Status: 'Ok',
      } as any);

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      await act(async () => {
        await result.current.fetchIncidentView('call123');
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.view).toEqual(mockView);
      });

      unmount();
    });
  });

  describe('stale request handling', () => {
    it('should clear the previous view synchronously when a new fetch starts', () => {
      useIncidentCommandStore.setState({ view: createMockView() as any });
      mockGetResourceIncidentView.mockImplementation(() => new Promise(() => {}) as any);

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      act(() => {
        result.current.fetchIncidentView('call-next');
      });

      expect(result.current.view).toBeNull();
      expect(result.current.isLoading).toBe(true);

      unmount();
    });

    it('should ignore a superseded fetch result', async () => {
      const staleView = { ...createMockView(), ImportantInformation: 'stale' };
      const freshView = { ...createMockView(), ImportantInformation: 'fresh' };
      let resolveFirst: (value: unknown) => void = () => {};
      mockGetResourceIncidentView
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }) as any
        )
        .mockResolvedValueOnce({ Data: freshView, Status: 'Ok' } as any);

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      let firstFetch: Promise<void> = Promise.resolve();
      act(() => {
        firstFetch = result.current.fetchIncidentView('call-old');
      });
      await act(async () => {
        await result.current.fetchIncidentView('call-new');
      });
      await act(async () => {
        resolveFirst({ Data: staleView, Status: 'Ok' });
        await firstFetch;
      });

      expect(result.current.view).toEqual(freshView);
      expect(result.current.isLoading).toBe(false);

      unmount();
    });

    it('should ignore a fetch result arriving after reset', async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      mockGetResourceIncidentView.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }) as any
      );

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      let pending: Promise<void> = Promise.resolve();
      act(() => {
        pending = result.current.fetchIncidentView('call123');
      });
      act(() => {
        result.current.reset();
      });
      await act(async () => {
        resolveFetch({ Data: createMockView(), Status: 'Ok' });
        await pending;
      });

      expect(result.current.view).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      unmount();
    });

    it('should ignore a fetch error arriving after reset', async () => {
      let rejectFetch: (error: Error) => void = () => {};
      mockGetResourceIncidentView.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFetch = reject;
          }) as any
      );

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      let pending: Promise<void> = Promise.resolve();
      act(() => {
        pending = result.current.fetchIncidentView('call123');
      });
      act(() => {
        result.current.reset();
      });
      await act(async () => {
        rejectFetch(new Error('late failure'));
        await pending;
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);

      unmount();
    });
  });

  describe('reset', () => {
    it('should reset the store to its initial state', async () => {
      useIncidentCommandStore.setState({
        view: createMockView() as any,
        isLoading: true,
        error: 'Some error',
      });

      const { result, unmount } = renderHook(() => useIncidentCommandStore());

      act(() => {
        result.current.reset();
      });

      expect(result.current.view).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      unmount();
    });
  });
});
