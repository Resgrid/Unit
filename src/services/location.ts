import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, type AppStateStatus } from 'react-native';

import { registerLocationServiceUpdater } from '@/lib/hooks/use-background-geolocation';
import { logger } from '@/lib/logging';
import { loadBackgroundGeolocationState } from '@/lib/storage/background-geolocation';
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
  private appStateSubscription: { remove: () => void } | null = null;
  private isBackgroundGeolocationEnabled = false;

  private constructor() {
    this.initializeAppStateListener();
    // Register this service's update function to avoid circular dependency
    registerLocationServiceUpdater(this.updateBackgroundGeolocationSetting.bind(this));
  }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  private initializeAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    logger.info({
      message: 'Location service handling app state change',
      context: { nextAppState, backgroundEnabled: this.isBackgroundGeolocationEnabled },
    });

    if (nextAppState === 'background' && this.isBackgroundGeolocationEnabled) {
      await this.startBackgroundUpdates();
    } else if (nextAppState === 'active') {
      await this.stopBackgroundUpdates();
    }
  };

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

    // Load background geolocation setting
    this.isBackgroundGeolocationEnabled = await loadBackgroundGeolocationState();

    // Check if task is already registered for background updates
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (!isTaskRegistered && this.isBackgroundGeolocationEnabled) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'Location Tracking',
          notificationBody: 'Tracking your location in the background',
        },
      });
      logger.info({
        message: 'Background location task registered',
      });
    }

    // Start foreground updates
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
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

    logger.info({
      message: 'Foreground location updates started',
      context: { backgroundEnabled: this.isBackgroundGeolocationEnabled },
    });
  }

  async startBackgroundUpdates(): Promise<void> {
    if (this.backgroundSubscription || !this.isBackgroundGeolocationEnabled) {
      return;
    }

    logger.info({
      message: 'Starting background location updates',
    });

    this.backgroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000,
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
      logger.info({
        message: 'Stopping background location updates',
      });
      await this.backgroundSubscription.remove();
      this.backgroundSubscription = null;
    }
    useLocationStore.getState().setBackgroundEnabled(false);
  }

  async updateBackgroundGeolocationSetting(enabled: boolean): Promise<void> {
    this.isBackgroundGeolocationEnabled = enabled;

    if (enabled) {
      // Register the task if not already registered
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isTaskRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'Location Tracking',
            notificationBody: 'Tracking your location in the background',
          },
        });
        logger.info({
          message: 'Background location task registered after setting change',
        });
      }

      // Start background updates if app is currently backgrounded
      if (AppState.currentState === 'background') {
        await this.startBackgroundUpdates();
      }
    } else {
      // Stop background updates and unregister task
      await this.stopBackgroundUpdates();
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        logger.info({
          message: 'Background location task unregistered after setting change',
        });
      }
    }
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

    logger.info({
      message: 'All location updates stopped',
    });
  }

  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const locationService = LocationService.getInstance();
