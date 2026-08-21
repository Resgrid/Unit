import { act, renderHook } from '@testing-library/react-native';

import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

// Mock the API
jest.mock('@/api/security/security', () => ({
  getCurrentUsersRights: jest.fn(),
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock MMKV
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    getBoolean: jest.fn(),
    getNumber: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/utils/network', () => ({
  isNetworkError: jest.fn(() => false),
}));

// Import after mocks
import { securityStore, useSecurityStore } from '../store';
import { getCurrentUsersRights } from '@/api/security/security';
import { logger } from '@/lib/logging';
import { isNetworkError } from '@/utils/network';

const mockGetCurrentUsersRights = getCurrentUsersRights as jest.MockedFunction<typeof getCurrentUsersRights>;
const mockIsNetworkError = isNetworkError as jest.MockedFunction<typeof isNetworkError>;

describe('useSecurityStore', () => {
  const mockRightsData: DepartmentRightsResultData = {
    DepartmentName: 'Test Department',
    DepartmentCode: 'TEST',
    FullName: 'Test User',
    EmailAddress: 'test@example.com',
    DepartmentId: 'dept-123',
    IsAdmin: true,
    CanViewPII: true,
    CanCreateCalls: true,
    CanAddNote: true,
    CanCreateMessage: true,
    Groups: [
      {
        GroupId: 1,
        IsGroupAdmin: true,
      },
      {
        GroupId: 2,
        IsGroupAdmin: false,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNetworkError.mockReturnValue(false);
    // Reset the store before each test
    act(() => {
      securityStore.setState({
        error: null,
        rights: null,
      });
    });
  });

  describe('getRights', () => {
    it('successfully fetches and stores user rights', async () => {
      const mockApiResponse = {
        Data: mockRightsData,
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      };

      mockGetCurrentUsersRights.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      expect(mockGetCurrentUsersRights).toHaveBeenCalledTimes(1);

      // Check that the store was updated
      const storeState = securityStore.getState();
      expect(storeState.rights).toEqual(mockRightsData);
    });

    it('handles API errors gracefully', async () => {
      const mockError = new Error('API Error');
      mockGetCurrentUsersRights.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      expect(mockGetCurrentUsersRights).toHaveBeenCalledTimes(1);

      // Store should not be updated on error
      const storeState = securityStore.getState();
      expect(storeState.rights).toBeNull();
    });

    it('logs non-network failures as errors with context', async () => {
      mockIsNetworkError.mockReturnValue(false);
      mockGetCurrentUsersRights.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to fetch user rights',
        })
      );
      expect(securityStore.getState().error).toBe('boom');
    });

    it('logs transient network failures at warn so they never reach Sentry', async () => {
      mockIsNetworkError.mockReturnValue(true);
      mockGetCurrentUsersRights.mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to fetch user rights due to network connectivity',
        })
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('keeps previously loaded rights when a refresh fails', async () => {
      act(() => {
        securityStore.setState({ rights: mockRightsData });
      });
      mockGetCurrentUsersRights.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      // Init must be able to continue with the rights it already has.
      expect(securityStore.getState().rights).toEqual(mockRightsData);
    });

    it('clears a previous error once a fetch succeeds', async () => {
      act(() => {
        securityStore.setState({ error: 'previous failure' });
      });
      mockGetCurrentUsersRights.mockResolvedValue({
        Data: mockRightsData,
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      });

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      expect(securityStore.getState().error).toBeNull();
    });
  });

  describe('permission checks', () => {
    beforeEach(() => {
      // Set up the store with mock data
      act(() => {
        securityStore.setState({
          rights: mockRightsData,
          error: null,
        });
      });
    });

    it('returns correct department admin status', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserDepartmentAdmin).toBe(true);
    });

    it('returns correct create calls permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateCalls).toBe(true);
    });

    it('returns correct create notes permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateNotes).toBe(true);
    });

    it('returns correct create messages permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateMessages).toBe(true);
    });

    it('returns correct view PII permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserViewPII).toBe(true);
    });

    it('returns correct department code', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.departmentCode).toBe('TEST');
    });

    it('correctly identifies group admin status', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserGroupAdmin(1)).toBe(true);
      expect(result.current.isUserGroupAdmin(2)).toBe(false);
      expect(result.current.isUserGroupAdmin(999)).toBe(false);
    });
  });

  describe('when no rights data is available', () => {
    beforeEach(() => {
      act(() => {
        securityStore.setState({
          rights: null,
          error: null,
        });
      });
    });

    it('returns undefined for all permission checks', () => {
      const { result } = renderHook(() => useSecurityStore());

      expect(result.current.isUserDepartmentAdmin).toBeUndefined();
      expect(result.current.canUserCreateCalls).toBeUndefined();
      expect(result.current.canUserCreateNotes).toBeUndefined();
      expect(result.current.canUserCreateMessages).toBeUndefined();
      expect(result.current.canUserViewPII).toBeUndefined();
      expect(result.current.departmentCode).toBeUndefined();
    });

    it('returns false for group admin checks', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserGroupAdmin(1)).toBe(false);
      expect(result.current.isUserGroupAdmin(999)).toBe(false);
    });
  });

  describe('edge cases for canUserCreateCalls', () => {
    it('handles false permission correctly', () => {
      const restrictedRights: DepartmentRightsResultData = {
        ...mockRightsData,
        CanCreateCalls: false,
      };

      act(() => {
        securityStore.setState({
          rights: restrictedRights,
          error: null,
        });
      });

      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateCalls).toBe(false);
    });

    it('handles null rights gracefully for canUserCreateCalls', () => {
      act(() => {
        securityStore.setState({
          rights: null,
          error: null,
        });
      });

      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateCalls).toBeUndefined();
    });

    it('handles empty groups array', () => {
      const rightsWithNoGroups: DepartmentRightsResultData = {
        ...mockRightsData,
        Groups: [],
      };

      act(() => {
        securityStore.setState({
          rights: rightsWithNoGroups,
          error: null,
        });
      });

      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserGroupAdmin(1)).toBe(false);
    });
  });
});
