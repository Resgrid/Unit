// Mock Platform first before any imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((specifics) => specifics.ios || specifics.default),
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

import { act, renderHook } from '@testing-library/react-native';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { CustomStatusResultData } from '@/models/v4/customStatuses/customStatusResultData';
import { GetSetUnitStateResult } from '@/models/v4/dispatch/getSetUnitStateResult';
import { UnitTypeStatusesResult } from '@/models/v4/statuses/unitTypeStatusesResult';
import { SaveUnitStatusInput, SaveUnitStatusRoleInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useCoreStore } from '@/stores/app/core-store';

import { useStatusBottomSheetStore, useStatusesStore } from '../store';

// Mock the API calls
jest.mock('@/api/dispatch/dispatch');
jest.mock('@/api/units/unitStatuses');
jest.mock('@/stores/app/core-store');
jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: {
    getState: jest.fn(() => ({
      latitude: null,
      longitude: null,
      accuracy: null,
      altitude: null,
      speed: null,
      heading: null,
    })),
  },
}));
jest.mock('@/stores/roles/store', () => ({
  useRolesStore: {
    getState: jest.fn(() => ({
      roles: [],
    })),
  },
}));
jest.mock('@/stores/calls/store', () => ({
    useCallsStore: {
      getState: jest.fn(() => ({
        calls: [],
        lastFetchedAt: 0,
      })),
      setState: jest.fn(),
    },
}));
jest.mock('@/services/offline-event-manager.service', () => ({
  offlineEventManager: {
    queueUnitStatusEvent: jest.fn(),
  },
}));
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetSetUnitStatusData = getSetUnitStatusData as jest.MockedFunction<typeof getSetUnitStatusData>;
const mockSaveUnitStatus = saveUnitStatus as jest.MockedFunction<typeof saveUnitStatus>;
const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockOfflineEventManager = offlineEventManager as jest.Mocked<typeof offlineEventManager>;

describe('StatusBottomSheetStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useStatusBottomSheetStore());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.currentStep).toBe('select-destination');
    expect(result.current.selectedCall).toBe(null);
    expect(result.current.selectedStation).toBe(null);
    expect(result.current.selectedPoi).toBe(null);
    expect(result.current.selectedDestinationType).toBe('none');
    expect(result.current.selectedStatus).toBe(null);
    expect(result.current.note).toBe('');
    expect(result.current.availableCalls).toEqual([]);
    expect(result.current.availableStations).toEqual([]);
    expect(result.current.availablePois).toEqual([]);
    expect(result.current.availablePoiTypes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('updates isOpen and selectedStatus when setIsOpen is called', () => {
    const { result } = renderHook(() => useStatusBottomSheetStore());

    const testStatus = new CustomStatusResultData();
    testStatus.Id = '1';
    testStatus.Text = 'Responding';
    testStatus.Note = 1;
    testStatus.Detail = 3;

    act(() => {
      result.current.setIsOpen(true, testStatus);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.selectedStatus).toEqual(testStatus);
  });

  it('fetches destination data successfully', async () => {
    const mockResponse = new GetSetUnitStateResult();
    mockResponse.Data.Calls = [
      {
        CallId: '1',
        Number: 'CALL001',
        Name: 'Test Call',
        Address: '123 Test St',
      } as any,
    ];
    mockResponse.Data.Stations = [
      {
        GroupId: '1',
        Name: 'Station 1',
        Address: '456 Station Ave',
      } as any,
    ];
    mockResponse.Data.DestinationPois = [
      {
        PoiId: 9,
        PoiTypeId: 1,
        PoiTypeName: 'Hospital',
        Name: 'Mercy Hospital',
        Address: '789 Care Way',
      } as any,
    ];
    mockResponse.Data.PoiTypes = [
      {
        PoiTypeId: 1,
        Name: 'Hospital',
        IsDestination: true,
      } as any,
    ];

    mockGetSetUnitStatusData.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useStatusBottomSheetStore());

    await act(async () => {
      await result.current.fetchDestinationData('unit1');
    });

    expect(mockGetSetUnitStatusData).toHaveBeenCalledWith('unit1');
    expect(result.current.availableCalls).toEqual(mockResponse.Data.Calls);
    expect(result.current.availableStations).toEqual(mockResponse.Data.Stations);
    expect(result.current.availablePois).toEqual(mockResponse.Data.DestinationPois);
    expect(result.current.availablePoiTypes).toEqual(mockResponse.Data.PoiTypes);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('resets all state when reset is called', () => {
    const { result } = renderHook(() => useStatusBottomSheetStore());

    const testStatus = new CustomStatusResultData();
    testStatus.Id = '1';
    testStatus.Text = 'Test';
    testStatus.Note = 1;
    testStatus.Detail = 3;

    // Set some state
    act(() => {
      result.current.setIsOpen(true, testStatus);
      result.current.setCurrentStep('add-note');
      result.current.setNote('Test note');
      result.current.setSelectedDestinationType('call');
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.currentStep).toBe('select-destination');
    expect(result.current.selectedCall).toBe(null);
    expect(result.current.selectedStation).toBe(null);
    expect(result.current.selectedPoi).toBe(null);
    expect(result.current.selectedDestinationType).toBe('none');
    expect(result.current.selectedStatus).toBe(null);
    expect(result.current.note).toBe('');
  });
});

describe('StatusesStore', () => {
  const mockActiveUnit = {
    UnitId: 'unit1',
  };

  const mockSetActiveUnitWithFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the zustand store pattern
    const mockStore = {
      activeUnit: mockActiveUnit,
      setActiveUnitWithFetch: mockSetActiveUnitWithFetch,
    };
    
    mockUseCoreStore.mockImplementation(() => mockStore);
    
    // Mock the getState() method as well
    (mockUseCoreStore as any).getState = jest.fn(() => mockStore);
  });

  it('saves unit status successfully', async () => {
    const mockResult = new UnitTypeStatusesResult();
    mockSaveUnitStatus.mockResolvedValueOnce(mockResult);
    mockSetActiveUnitWithFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useStatusesStore());

    const input = new SaveUnitStatusInput();
    input.Id = 'unit1';
    input.Type = '1';
    input.Note = 'Test note';

    await act(async () => {
      await result.current.saveUnitStatus(input);
    });

    expect(mockSaveUnitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        Id: 'unit1',
        Type: '1',
        Note: 'Test note',
        Timestamp: expect.any(String),
        TimestampUtc: expect.any(String),
      })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should queue unit status event when direct save fails', async () => {
    const { result } = renderHook(() => useStatusesStore());

    mockSaveUnitStatus.mockRejectedValue(new Error('Network error'));
    mockOfflineEventManager.queueUnitStatusEvent.mockReturnValue('queued-event-id');
    mockUseCoreStore.mockReturnValue({
      activeUnit: { UnitId: 'unit1' },
      setActiveUnitWithFetch: jest.fn(),
    } as any);

    const input = new SaveUnitStatusInput();
    input.Id = 'unit1';
    input.Type = '1';
    input.Note = 'Test note';
    input.RespondingTo = 'call1';

    const role = new SaveUnitStatusRoleInput();
    role.RoleId = 'role1';
    role.UserId = 'user1';
    input.Roles = [role];

    await act(async () => {
      await result.current.saveUnitStatus(input);
    });

    expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
      'unit1',
      '1',
      'Test note',
      'call1',
      null,
      [{ roleId: 'role1', userId: 'user1' }],
      undefined
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle successful save and refresh active unit', async () => {
    const { result } = renderHook(() => useStatusesStore());

    const mockSetActiveUnitWithFetch = jest.fn();
    const mockCoreStore = {
      activeUnit: { UnitId: 'unit1' },
      setActiveUnitWithFetch: mockSetActiveUnitWithFetch,
    };
    
    mockSaveUnitStatus.mockResolvedValue({} as UnitTypeStatusesResult);
    mockUseCoreStore.mockReturnValue(mockCoreStore as any);
    
    // Mock the getState method to return our mock store
    (mockUseCoreStore as any).getState = jest.fn().mockReturnValue(mockCoreStore);

    const input = new SaveUnitStatusInput();
    input.Id = 'unit1';
    input.Type = '1';

    await act(async () => {
      await result.current.saveUnitStatus(input);
    });

    expect(mockSaveUnitStatus).toHaveBeenCalled();
    expect(mockSetActiveUnitWithFetch).toHaveBeenCalledWith('unit1');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle input without roles when queueing', async () => {
    const { result } = renderHook(() => useStatusesStore());

    mockSaveUnitStatus.mockRejectedValue(new Error('Network error'));
    mockOfflineEventManager.queueUnitStatusEvent.mockReturnValue('queued-event-id');
    mockUseCoreStore.mockReturnValue({
      activeUnit: { UnitId: 'unit1' },
      setActiveUnitWithFetch: jest.fn(),
    } as any);

    const input = new SaveUnitStatusInput();
    input.Id = 'unit1';
    input.Type = '1';
    // Don't set Roles, Note, or RespondingTo to test their default values

    await act(async () => {
      await result.current.saveUnitStatus(input);
    });

    expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
      'unit1',
      '1',
      '', // Note defaults to empty string
      '', // RespondingTo defaults to empty string  
      null,
      [], // Roles defaults to empty array which maps to empty array
      undefined
    );
  });

  it('should handle critical errors during processing', async () => {
    const { result } = renderHook(() => useStatusesStore());

    mockSaveUnitStatus.mockRejectedValue(new Error('Network error'));
    mockOfflineEventManager.queueUnitStatusEvent.mockImplementation(() => {
      throw new Error('Critical error');
    });
    mockUseCoreStore.mockReturnValue({
      activeUnit: { UnitId: 'unit1' },
      setActiveUnitWithFetch: jest.fn(),
    } as any);

    const input = new SaveUnitStatusInput();
    input.Id = 'unit1';
    input.Type = '1';

    await act(async () => {
      try {
        await result.current.saveUnitStatus(input);
      } catch (error) {
        // Expected to throw now since we re-throw critical errors
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Failed to save unit status');
  });
});
