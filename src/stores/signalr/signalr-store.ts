import { create } from 'zustand';

import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { signalRService } from '@/services/signalr.service';

interface SignalRState {
  isUpdateHubConnected: boolean;
  lastUpdateMessage: unknown;
  lastUpdateTimestamp: number;
  isGeolocationHubConnected: boolean;
  lastGeolocationMessage: unknown;
  lastGeolocationTimestamp: number;
  error: Error | null;
  connectUpdateHub: () => Promise<void>;
  disconnectUpdateHub: () => Promise<void>;
  connectGeolocationHub: () => Promise<void>;
  disconnectGeolocationHub: () => Promise<void>;
}

export const useSignalRStore = create<SignalRState>((set) => ({
  isUpdateHubConnected: false,
  lastUpdateMessage: null,
  lastUpdateTimestamp: 0,
  isGeolocationHubConnected: false,
  lastGeolocationMessage: null,
  lastGeolocationTimestamp: 0,
  error: null,
  connectUpdateHub: async () => {
    try {
      set({ isUpdateHubConnected: false, error: null });

      // Connect to the eventing hub
      await signalRService.connectToHub({
        name: Env.CHANNEL_HUB_NAME,
        url: `${Env.CHANNEL_API_URL}${Env.CHANNEL_HUB_NAME}`,
        methods: ['personnelStatusUpdated', 'personnelStaffingUpdated', 'unitStatusUpdated', 'callsUpdated', 'callAdded', 'callClosed', 'onConnected'],
      });

      signalRService.on('personnelStatusUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('personnelStaffingUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('unitStatusUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('callsUpdated', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('callAdded', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('callClosed', (message) => {
        set({ lastUpdateMessage: JSON.stringify(message), lastUpdateTimestamp: Date.now() });
      });

      signalRService.on('onConnected', () => {
        logger.info({
          message: 'Connected to update SignalR hub',
        });
        set({ isUpdateHubConnected: true, error: null });
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to connect to SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  disconnectUpdateHub: async () => {
    try {
      await signalRService.disconnectFromHub(Env.CHANNEL_HUB_NAME);
      set({ isUpdateHubConnected: false, lastUpdateMessage: null });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  connectGeolocationHub: async () => {
    try {
      set({ isGeolocationHubConnected: false, error: null });

      // Connect to the geolocation hub
      await signalRService.connectToHub({
        name: Env.REALTIME_GEO_HUB_NAME,
        url: `${Env.CHANNEL_API_URL}${Env.REALTIME_GEO_HUB_NAME}`,
        methods: ['onPersonnelLocationUpdated', 'onUnitLocationUpdated', 'onGeolocationConnect'],
      });

      // Set up message handler
      signalRService.on('onPersonnelLocationUpdated', (message) => {
        set({ lastGeolocationMessage: JSON.stringify(message), lastGeolocationTimestamp: Date.now() });
      });

      signalRService.on('onUnitLocationUpdated', (message) => {
        set({ lastGeolocationMessage: JSON.stringify(message), lastGeolocationTimestamp: Date.now() });
      });

      signalRService.on('onGeolocationConnect', () => {
        logger.info({
          message: 'Connected to geolocation SignalR hub',
        });
        set({ isGeolocationHubConnected: true, error: null });
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to connect to SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  disconnectGeolocationHub: async () => {
    try {
      await signalRService.disconnectFromHub(Env.REALTIME_GEO_HUB_NAME);
      set({ isGeolocationHubConnected: false, lastGeolocationMessage: null });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
}));
