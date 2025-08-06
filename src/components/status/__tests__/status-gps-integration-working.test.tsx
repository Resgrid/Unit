/**
 * GPS Integration Tests for Status Bottom Sheet
 * Tests GPS coordinate handling in statu      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objec      expect(mockSaveUni      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.obje      expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
        'unit1',
        '2',
        'Offline GPS status',
        '',
        [],
        {
          latitude: '40.7128',
          longitude: '-74.006',
          altitude: '100',
          heading: '90',
          speed: '25',
          accuracy: '15',
          altitudeAccuracy: '',
        },
      );
    });          Latitude: '40.7128',
          Longitude: '-74.006',
          Accuracy: '',
          Altitude: '',
          Speed: '',
          Head      expect(mockOfflineEventManager.queueUnitStatusEvent)      expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
        'unit1',
        '5',
        'Complex status with GPS',
        'call123',
        [{ userId: 'user1', roleId: 'role1' }],
        {
          latitude: '51.5074',
          longitude: '-0.1278',
          accuracy: '8',
          altitude: '',
          speed: '30',
          heading: '',
          altitudeAccuracy: '',
        },
      );edWith(
        'unit1',
        '4',
        'Partial GPS',
        '',
        [],
        {
          latitude: '35.6762',
          longitude: '139.6503',
          accuracy: '',
          altitude: '',
          speed: '',
          heading: '',
          altitudeAccuracy: '',
        },
      );    AltitudeAccuracy: '',
        }),
      );oHaveBeenC      expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
        'unit1',
        '2',
        'Offline GPS status',
        '',
        [],
        {
          latitude: '40.7128',
          longitude: '-74.006',
          accuracy: '15',
          altitude: '100',
          speed: '25',
          heading: '90',
          altitudeAccuracy: '',
        },
      );    expect.objectContaining({
          Latitude: '40.7128',
          Longitude: '-74.006',
          Accuracy: '',
          Altitude: '',
          Speed: '',
          Heading: '',
          AltitudeAccuracy: '',
        }),
      );g({
          Id: 'unit1',
          Type: '1',
          Note: 'GPS enabled status',
          Latitude: '40.7128',
          Longitude: '-74.006',
          Accuracy: '10',
          Altitude: '50',
          Speed: '0',
          Heading: '180',
          AltitudeAccuracy: '',
        }),
      );
 */

import { act, renderHook } from '@testing-library/react-native';

import { SaveUnitStatusInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useLocationStore } from '@/stores/app/location-store';
import { useStatusesStore } from '@/stores/status/store';

// Mock the dependencies
jest.mock('@/api/units/unitStatuses', () => ({
  saveUnitStatus: jest.fn(),
}));

jest.mock('@/services/offline-event-manager.service', () => ({
  offlineEventManager: {
    queueUnitStatusEvent: jest.fn(),
  },
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn(),
}));

const mockOfflineEventManager = offlineEventManager as jest.Mocked<typeof offlineEventManager>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<any>;
const mockUseCoreStore = require('@/stores/app/core-store').useCoreStore as jest.MockedFunction<any>;
const mockSaveUnitStatus = require('@/api/units/unitStatuses').saveUnitStatus as jest.MockedFunction<any>;

describe('Status GPS Integration', () => {
  let mockLocationStore: any;
  let mockCoreStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLocationStore = {
      latitude: null,
      longitude: null,
      heading: null,
      accuracy: null,
      speed: null,
      altitude: null,
      timestamp: null,
    };

    mockCoreStore = {
      activeUnit: { UnitId: 'unit1' },
      setActiveUnitWithFetch: jest.fn(),
    };

    mockUseLocationStore.mockImplementation(() => {
      console.log('useLocationStore called, returning:', mockLocationStore);
      return mockLocationStore;
    });
    // Also mock getState for the location store logic
    (mockUseLocationStore as any).getState = jest.fn().mockReturnValue(mockLocationStore);

    mockUseCoreStore.mockReturnValue(mockCoreStore);
    // Also mock getState for the status store logic
    (mockUseCoreStore as any).getState = jest.fn().mockReturnValue(mockCoreStore);
    mockOfflineEventManager.queueUnitStatusEvent.mockReturnValue('queued-event-id');
  });

  describe('GPS Coordinate Integration', () => {
    it('should include GPS coordinates when available during successful submission', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Set up location data
      mockLocationStore.latitude = 40.7128;
      mockLocationStore.longitude = -74.0060;
      mockLocationStore.accuracy = 10;
      mockLocationStore.altitude = 50;
      mockLocationStore.speed = 0;
      mockLocationStore.heading = 180;

      mockSaveUnitStatus.mockResolvedValue({});

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '1';
      input.Note = 'GPS enabled status';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          Id: 'unit1',
          Type: '1',
          Note: 'GPS enabled status',
          Latitude: '40.7128',
          Longitude: '-74.006',
          Accuracy: '10',
          Altitude: '50',
          Speed: '0',
          Heading: '180',
        })
      );
    });

    it('should not include GPS coordinates when location data is not available', async () => {
      const { result } = renderHook(() => useStatusesStore());

      mockSaveUnitStatus.mockResolvedValue({});

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '1';
      input.Note = 'No GPS status';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          Id: 'unit1',
          Type: '1',
          Note: 'No GPS status',
          Latitude: '',
          Longitude: '',
          Accuracy: '',
          Altitude: '',
          Speed: '',
          Heading: '',
        })
      );
    });

    it('should handle partial GPS data (only lat/lon available)', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Set up minimal location data
      mockLocationStore.latitude = 40.7128;
      mockLocationStore.longitude = -74.0060;
      // Other fields remain null

      mockSaveUnitStatus.mockResolvedValue({});

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '1';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          Latitude: '40.7128',
          Longitude: '-74.006',
          Accuracy: '',
          Altitude: '',
          Speed: '',
          Heading: '',
          AltitudeAccuracy: '',
        })
      );
    });

    it('should include GPS coordinates in offline queue when submission fails', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Set up location data
      mockLocationStore.latitude = 40.7128;
      mockLocationStore.longitude = -74.0060;
      mockLocationStore.accuracy = 15;
      mockLocationStore.altitude = 100;
      mockLocationStore.speed = 25;
      mockLocationStore.heading = 90;

      mockSaveUnitStatus.mockRejectedValue(new Error('Network error'));

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '2';
      input.Note = 'Offline GPS status';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
        'unit1',
        '2',
        'Offline GPS status',
        '',
        [],
        {
          latitude: '40.7128',
          longitude: '-74.006',
          accuracy: '15',
          altitude: '100',
          altitudeAccuracy: '',
          speed: '25',
          heading: '90',
        }
      );
    });

    it('should not include GPS data in offline queue when location is unavailable', async () => {
      const { result } = renderHook(() => useStatusesStore());

      mockSaveUnitStatus.mockRejectedValue(new Error('Network error'));

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '3';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
        'unit1',
        '3',
        '',
        '',
        [],
        undefined
      );
    });

    it('should handle high precision GPS coordinates', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Set up high precision location data
      mockLocationStore.latitude = 40.712821;
      mockLocationStore.longitude = -74.006015;
      mockLocationStore.accuracy = 3;
      mockLocationStore.altitude = 10.5;
      mockLocationStore.speed = 5.2;
      mockLocationStore.heading = 245.8;

      mockSaveUnitStatus.mockResolvedValue({});

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '1';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          Latitude: '40.712821',
          Longitude: '-74.006015',
          Accuracy: '3',
          Altitude: '10.5',
          Speed: '5.2',
          Heading: '245.8',
        })
      );
    });

    it('should handle edge case GPS values (zeros and negatives)', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Set up edge case location data
      mockLocationStore.latitude = 0;
      mockLocationStore.longitude = 0;
      mockLocationStore.accuracy = 0;
      mockLocationStore.altitude = -50; // Below sea level
      mockLocationStore.speed = 0;
      mockLocationStore.heading = 0;

      mockSaveUnitStatus.mockResolvedValue({});

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '1';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          Latitude: '0',
          Longitude: '0',
          Accuracy: '0',
          Altitude: '-50',
          Speed: '0',
          Heading: '0',
        })
      );
    });

    it('should prioritize input GPS coordinates over location store when both exist', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Set up location store data
      mockLocationStore.latitude = 40.7128;
      mockLocationStore.longitude = -74.0060;
      mockLocationStore.accuracy = 10;

      mockSaveUnitStatus.mockResolvedValue({});

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '1';
      // Pre-populate input with different GPS coordinates
      input.Latitude = '41.8781';
      input.Longitude = '-87.6298';
      input.Accuracy = '5';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      // Should use the input coordinates, not location store
      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          Latitude: '41.8781',
          Longitude: '-87.6298',
          Accuracy: '5',
        })
      );
    });

    it('should handle null/undefined GPS values gracefully', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Set up mixed null/undefined location data
      mockLocationStore.latitude = 40.7128;
      mockLocationStore.longitude = -74.0060;
      mockLocationStore.accuracy = null;
      mockLocationStore.altitude = undefined;
      mockLocationStore.speed = null;
      mockLocationStore.heading = undefined;

      mockSaveUnitStatus.mockResolvedValue({});

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '1';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockSaveUnitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          Latitude: '40.7128',
          Longitude: '-74.006',
          Accuracy: '',
          Altitude: '',
          Speed: '',
          Heading: '',
          AltitudeAccuracy: '',
        })
      );
    });
  });

  describe('Offline GPS Integration', () => {
    it('should queue GPS data with partial location information', async () => {
      const { result } = renderHook(() => useStatusesStore());

      // Only latitude and longitude available
      mockLocationStore.latitude = 35.6762;
      mockLocationStore.longitude = 139.6503;

      mockSaveUnitStatus.mockRejectedValue(new Error('Network error'));

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '4';
      input.Note = 'Partial GPS';

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
        'unit1',
        '4',
        'Partial GPS',
        '',
        [],
        {
          latitude: '35.6762',
          longitude: '139.6503',
          accuracy: '',
          altitude: '',
          speed: '',
          heading: '',
          altitudeAccuracy: '',
        }
      );
    });

    it('should handle GPS data with roles and complex status data', async () => {
      const { result } = renderHook(() => useStatusesStore());

      mockLocationStore.latitude = 51.5074;
      mockLocationStore.longitude = -0.1278;
      mockLocationStore.accuracy = 8;
      mockLocationStore.speed = 30;

      mockSaveUnitStatus.mockRejectedValue(new Error('Network error'));

      const input = new SaveUnitStatusInput();
      input.Id = 'unit1';
      input.Type = '5';
      input.Note = 'Complex status with GPS';
      input.RespondingTo = 'call123';
      input.Roles = [{
        Id: '1',
        EventId: '',
        UserId: 'user1',
        RoleId: 'role1',
        Name: 'Driver',
      }];

      await act(async () => {
        await result.current.saveUnitStatus(input);
      });

      expect(mockOfflineEventManager.queueUnitStatusEvent).toHaveBeenCalledWith(
        'unit1',
        '5',
        'Complex status with GPS',
        'call123',
        [{ roleId: 'role1', userId: 'user1' }],
        {
          latitude: '51.5074',
          longitude: '-0.1278',
          accuracy: '8',
          altitude: '',
          speed: '30',
          heading: '',
          altitudeAccuracy: '',
        }
      );
    });
  });
});
