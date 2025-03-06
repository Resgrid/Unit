import { create } from 'zustand';

import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { signalRService } from '@/services/signalr.service';

interface SignalRState {
  isConnected: boolean;
  lastMessage: unknown;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useSignalRStore = create<SignalRState>((set) => ({
  isConnected: false,
  lastMessage: null,
  error: null,
  connect: async () => {
    try {
      // Connect to the eventing hub
      await signalRService.connectToHub({
        name: Env.CHANNEL_HUB_NAME,
        url: `${Env.CHANNEL_API_URL}${Env.CHANNEL_HUB_NAME}`,
        methods: ['ReceiveMessage', 'ReceiveEvent', 'ReceiveStatusUpdate'],
      });

      // Connect to the geolocation hub
      await signalRService.connectToHub({
        name: Env.REALTIME_GEO_HUB_NAME,
        url: `${Env.CHANNEL_API_URL}${Env.REALTIME_GEO_HUB_NAME}`,
        methods: ['ReceiveLocationUpdate', 'ReceiveUnitStatusUpdate'],
      });

      // Set up message handler
      signalRService.on('message', (message) => {
        set({ lastMessage: message });
      });

      set({ isConnected: true, error: null });
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to connect to SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  disconnect: async () => {
    try {
      await signalRService.disconnectAll();
      set({ isConnected: false, lastMessage: null });
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
}));
