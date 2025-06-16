import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { loadBackgroundGeolocationState } from '@/lib/hooks/use-background-geolocation';
import { logger } from '@/lib/logging';
import { useLocationStore } from '@/stores/app/location-store';

const LOCATION_TASK_NAME = 'location-updates';

// Define the task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    logger.error({
      message: 'Location task error',
      context: { error },
    });
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (location) {
      logger.info({
        message: 'Background location update received',
        context: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
        },
      });
      useLocationStore.getState().setLocation(location);
    }
  }
});

class LocationService {
  private static instance: LocationService;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundSubscription: Location.LocationSubscription | null = null;

  private constructor() {}

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    logger.info({
      message: 'Location permissions requested',
      context: {
        foregroundStatus,
        backgroundStatus,
      },
    });

    return foregroundStatus === 'granted' && backgroundStatus === 'granted';
  }

  async startLocationUpdates(): Promise<void> {
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Location permissions not granted');
    }

    // Check if task is already registered
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (!isTaskRegistered) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'Location Tracking',
          notificationBody: 'Tracking your location in the background',
        },
      });
      logger.info({
        message: 'Location task registered',
      });
    }

    // Start foreground updates
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        logger.info({
          message: 'Foreground location update received',
          context: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
          },
        });
        useLocationStore.getState().setLocation(location);
      }
    );

    // Start background updates if enabled in settings
    const isBackgroundEnabled = await loadBackgroundGeolocationState();
    if (isBackgroundEnabled) {
      await this.startBackgroundUpdates();
    }
  }

  async startBackgroundUpdates(): Promise<void> {
    if (this.backgroundSubscription) {
      return;
    }

    this.backgroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 20,
      },
      (location) => {
        logger.info({
          message: 'Background location update received',
          context: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
          },
        });
        useLocationStore.getState().setLocation(location);
      }
    );

    useLocationStore.getState().setBackgroundEnabled(true);
  }

  async stopBackgroundUpdates(): Promise<void> {
    if (this.backgroundSubscription) {
      await this.backgroundSubscription.remove();
      this.backgroundSubscription = null;
    }
    useLocationStore.getState().setBackgroundEnabled(false);
  }

  async stopLocationUpdates(): Promise<void> {
    if (this.locationSubscription) {
      await this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    await this.stopBackgroundUpdates();

    // Check if task is registered before stopping
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isTaskRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  }
}

export const locationService = LocationService.getInstance();
