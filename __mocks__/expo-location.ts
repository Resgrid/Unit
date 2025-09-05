export const LocationAccuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

export const LocationActivityType = {
  Other: 1,
  AutomotiveNavigation: 2,
  Fitness: 3,
  OtherNavigation: 4,
  Airborne: 5,
};

export const requestForegroundPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
});

export const requestBackgroundPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
});

export const getCurrentPositionAsync = jest.fn().mockResolvedValue({
  coords: {
    latitude: 40.7128,
    longitude: -74.006,
    altitude: null,
    accuracy: 5,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
});

export const watchPositionAsync = jest.fn().mockImplementation((options, callback) => {
  const interval = setInterval(() => {
    callback({
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
        altitude: null,
        accuracy: 5,
        altitudeAccuracy: null,
        heading: 0,
        speed: null,
      },
      timestamp: Date.now(),
    });
  }, 1000);

  return Promise.resolve({
    remove: () => clearInterval(interval),
  });
});

export const startLocationUpdatesAsync = jest.fn().mockResolvedValue(undefined);
export const stopLocationUpdatesAsync = jest.fn().mockResolvedValue(undefined);
export const hasStartedLocationUpdatesAsync = jest.fn().mockResolvedValue(false);
