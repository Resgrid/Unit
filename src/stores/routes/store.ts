import { create } from 'zustand';

import {
  acknowledgeDeviation,
  cancelRoute,
  checkInAtStop,
  checkOutFromStop,
  endRoute,
  geofenceCheckIn,
  getActiveRouteForUnit,
  getInstanceDirections,
  getRouteHistory,
  getRoutePlan,
  getRoutePlans,
  getRoutePlansForUnit,
  getRouteProgress,
  getStopsForInstance,
  getUnacknowledgedDeviations,
  pauseRoute,
  resumeRoute,
  skipStop,
  startRoute,
  updateStopNotes,
} from '@/api/routes/routes';
import { type DirectionsResultData } from '@/models/v4/routes/directionsResultData';
import { type RouteDeviationResultData } from '@/models/v4/routes/routeDeviationResultData';
import { type RouteInstanceResultData } from '@/models/v4/routes/routeInstanceResultData';
import { type RouteInstanceStopResultData } from '@/models/v4/routes/routeInstanceStopResultData';
import { type RoutePlanResultData } from '@/models/v4/routes/routePlanResultData';

interface RoutesState {
  // Data
  routePlans: RoutePlanResultData[];
  activePlan: RoutePlanResultData | null;
  activeInstance: RouteInstanceResultData | null;
  instanceStops: RouteInstanceStopResultData[];
  directions: DirectionsResultData | null;
  deviations: RouteDeviationResultData[];
  routeHistory: RouteInstanceResultData[];
  isTracking: boolean;

  // Loading states
  isLoading: boolean;
  isLoadingStops: boolean;
  isLoadingDirections: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions - Route Plans
  fetchRoutePlans: (unitId: string) => Promise<void>;
  fetchAllRoutePlans: () => Promise<void>;
  fetchRoutePlan: (routePlanId: string) => Promise<void>;

  // Actions - Route Lifecycle
  startRouteInstance: (routePlanId: string, unitId: string) => Promise<void>;
  endRouteInstance: (instanceId: string) => Promise<void>;
  pauseRouteInstance: (instanceId: string) => Promise<void>;
  resumeRouteInstance: (instanceId: string) => Promise<void>;
  cancelRouteInstance: (instanceId: string) => Promise<void>;

  // Actions - Instance Tracking
  fetchActiveRoute: (unitId: string) => Promise<void>;
  fetchRouteProgress: (instanceId: string) => Promise<void>;
  fetchStopsForInstance: (instanceId: string) => Promise<void>;
  fetchDirections: (instanceId: string) => Promise<void>;

  // Actions - Stop Interactions
  checkIn: (stopId: string, unitId: string, lat: number, lon: number) => Promise<void>;
  checkOut: (stopId: string, unitId: string) => Promise<void>;
  skip: (stopId: string, reason: string) => Promise<void>;
  performGeofenceCheckIn: (unitId: string, lat: number, lon: number) => Promise<void>;
  updateNotes: (stopId: string, notes: string) => Promise<void>;

  // Actions - Deviations
  fetchDeviations: () => Promise<void>;
  ackDeviation: (deviationId: string) => Promise<void>;

  // Actions - History
  fetchRouteHistory: (routePlanId: string) => Promise<void>;

  // Actions - State management
  setTracking: (tracking: boolean) => void;
  clearActiveRoute: () => void;
}

export const useRoutesStore = create<RoutesState>((set, get) => ({
  // Initial state
  routePlans: [],
  activePlan: null,
  activeInstance: null,
  instanceStops: [],
  directions: null,
  deviations: [],
  routeHistory: [],
  isTracking: false,
  isLoading: false,
  isLoadingStops: false,
  isLoadingDirections: false,
  isInitialized: false,
  error: null,

  // --- Route Plans ---
  fetchRoutePlans: async (unitId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRoutePlansForUnit(unitId);
      set({
        routePlans: Array.isArray(response.Data) ? response.Data : [],
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      set({ error: 'Failed to fetch route plans', isLoading: false });
    }
  },

  fetchAllRoutePlans: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRoutePlans();
      set({
        routePlans: Array.isArray(response.Data) ? response.Data : [],
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      set({ error: 'Failed to fetch route plans', isLoading: false });
    }
  },

  fetchRoutePlan: async (routePlanId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRoutePlan(routePlanId);
      set({ activePlan: response.Data, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch route plan', isLoading: false });
    }
  },

  // --- Route Lifecycle ---
  startRouteInstance: async (routePlanId: string, unitId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await startRoute({ RoutePlanId: routePlanId, UnitId: unitId });
      set({ activeInstance: response.Data, isLoading: false, isTracking: true });
    } catch (error) {
      set({ error: 'Failed to start route', isLoading: false });
      throw error;
    }
  },

  endRouteInstance: async (instanceId: string) => {
    set({ isLoading: true, error: null });
    try {
      await endRoute({ RouteInstanceId: instanceId });
      set({
        activeInstance: null,
        instanceStops: [],
        directions: null,
        deviations: [],
        isTracking: false,
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to end route', isLoading: false });
      throw error;
    }
  },

  pauseRouteInstance: async (instanceId: string) => {
    try {
      await pauseRoute({ RouteInstanceId: instanceId });
      const { activeInstance } = get();
      if (activeInstance) {
        set({ activeInstance: { ...activeInstance, Status: 2 }, isTracking: false });
      }
    } catch (error) {
      set({ error: 'Failed to pause route' });
    }
  },

  resumeRouteInstance: async (instanceId: string) => {
    try {
      await resumeRoute({ RouteInstanceId: instanceId });
      const { activeInstance } = get();
      if (activeInstance) {
        set({ activeInstance: { ...activeInstance, Status: 1 }, isTracking: true });
      }
    } catch (error) {
      set({ error: 'Failed to resume route' });
    }
  },

  cancelRouteInstance: async (instanceId: string) => {
    set({ isLoading: true, error: null });
    try {
      await cancelRoute({ RouteInstanceId: instanceId });
      set({
        activeInstance: null,
        instanceStops: [],
        directions: null,
        deviations: [],
        isTracking: false,
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to cancel route', isLoading: false });
      throw error;
    }
  },

  // --- Instance Tracking ---
  fetchActiveRoute: async (unitId: string) => {
    try {
      const response = await getActiveRouteForUnit(unitId);
      const data = response.Data;
      if (data?.Instance) {
        set({
          activeInstance: data.Instance,
          instanceStops: Array.isArray(data.Stops) ? data.Stops : [],
          directions: null,
          deviations: [],
          isTracking: true,
        });
      } else {
        set({
          activeInstance: null,
          instanceStops: [],
          directions: null,
          deviations: [],
          isTracking: false,
        });
      }
    } catch (error) {
      set({
        activeInstance: null,
        instanceStops: [],
        directions: null,
        deviations: [],
        isTracking: false,
      });
    }
  },

  fetchRouteProgress: async (instanceId: string) => {
    try {
      const response = await getRouteProgress(instanceId);
      set({ activeInstance: response.Data });
    } catch (error) {
      set({ error: 'Failed to fetch route progress' });
    }
  },

  fetchStopsForInstance: async (instanceId: string) => {
    set({ isLoadingStops: true });
    try {
      const response = await getStopsForInstance(instanceId);
      set({
        instanceStops: Array.isArray(response.Data) ? response.Data : [],
        isLoadingStops: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch stops', isLoadingStops: false });
    }
  },

  fetchDirections: async (instanceId: string) => {
    set({ isLoadingDirections: true });
    try {
      const response = await getInstanceDirections(instanceId);
      set({ directions: response.Data, isLoadingDirections: false });
    } catch (error) {
      set({ error: 'Failed to fetch directions', isLoadingDirections: false });
    }
  },

  // --- Stop Interactions ---
  checkIn: async (stopId: string, unitId: string, lat: number, lon: number) => {
    try {
      await checkInAtStop({
        RouteInstanceStopId: stopId,
        UnitId: unitId,
        Latitude: lat,
        Longitude: lon,
      });
      const { instanceStops } = get();
      set({
        instanceStops: instanceStops.map((s) => (s.RouteInstanceStopId === stopId ? { ...s, Status: 1, CheckedInOn: new Date().toISOString() } : s)),
      });
    } catch (error) {
      set({ error: 'Failed to check in at stop' });
    }
  },

  checkOut: async (stopId: string, unitId: string) => {
    try {
      await checkOutFromStop({ RouteInstanceStopId: stopId, UnitId: unitId });
      const { instanceStops } = get();
      set({
        instanceStops: instanceStops.map((s) => (s.RouteInstanceStopId === stopId ? { ...s, Status: 2, CheckedOutOn: new Date().toISOString() } : s)),
      });
    } catch (error) {
      set({ error: 'Failed to check out from stop' });
    }
  },

  skip: async (stopId: string, reason: string) => {
    try {
      await skipStop({ RouteInstanceStopId: stopId, Reason: reason });
      const { instanceStops } = get();
      set({
        instanceStops: instanceStops.map((s) => (s.RouteInstanceStopId === stopId ? { ...s, Status: 3, SkippedOn: new Date().toISOString() } : s)),
      });
    } catch (error) {
      set({ error: 'Failed to skip stop' });
    }
  },

  performGeofenceCheckIn: async (unitId: string, lat: number, lon: number) => {
    try {
      await geofenceCheckIn({ UnitId: unitId, Latitude: lat, Longitude: lon });
    } catch (error) {
      // Geofence check-in failures are non-critical
    }
  },

  updateNotes: async (stopId: string, notes: string) => {
    try {
      await updateStopNotes({ RouteInstanceStopId: stopId, Notes: notes });
      const { instanceStops } = get();
      set({
        instanceStops: instanceStops.map((s) => (s.RouteInstanceStopId === stopId ? { ...s, Notes: notes } : s)),
      });
    } catch (error) {
      set({ error: 'Failed to update stop notes' });
    }
  },

  // --- Deviations ---
  fetchDeviations: async () => {
    try {
      const response = await getUnacknowledgedDeviations();
      set({ deviations: Array.isArray(response.Data) ? response.Data : [] });
    } catch (error) {
      // Non-critical
    }
  },

  ackDeviation: async (deviationId: string) => {
    try {
      await acknowledgeDeviation(deviationId);
      const { deviations } = get();
      set({
        deviations: deviations.filter((d) => d.RouteDeviationId !== deviationId),
      });
    } catch (error) {
      set({ error: 'Failed to acknowledge deviation' });
    }
  },

  // --- History ---
  fetchRouteHistory: async (routePlanId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRouteHistory(routePlanId);
      set({
        routeHistory: Array.isArray(response.Data) ? response.Data : [],
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch route history', isLoading: false });
    }
  },

  // --- State management ---
  setTracking: (tracking: boolean) => set({ isTracking: tracking }),

  clearActiveRoute: () =>
    set({
      activeInstance: null,
      instanceStops: [],
      directions: null,
      deviations: [],
      isTracking: false,
    }),
}));
