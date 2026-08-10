import { create } from 'zustand';

import { useAuthStore } from '@/lib';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { SignalRService, signalRService } from '@/services/signalr.service';

import { useCoreStore } from '../app/core-store';
import { useChatStore } from '../chat/store';
import { FeatureFlagKeys, featureFlagsStore } from '../feature-flags/store';
import { securityStore } from '../security/store';
import { useWeatherAlertsStore } from '../weather-alerts/store';

/** Client-event method names raised by the chat SignalR hub. */
const CHAT_HUB_METHODS = [
  'chatMessageReceived',
  'chatMessageEdited',
  'chatMessageDeleted',
  'chatReactionUpdated',
  'chatReceiptUpdated',
  'chatChannelUpdated',
  'chatChannelProvisioned',
  'chatModerationApplied',
  'chatMessageAckRequired',
  'chatThreadUpdated',
  'chatbotMessageReceived',
  'chatbotTyping',
  'chatTyping',
  'chatPresenceChanged',
  'onChatConnected',
];

// Track registered chat handlers for cleanup and the heartbeat timer.
// Hub methods can send several positional arguments, so handlers are variadic.
const chatHubHandlers: Record<string, ((...args: unknown[]) => void) | null> = {};
let chatHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
const CHAT_HEARTBEAT_INTERVAL_MS = 45000;

function unregisterChatHubHandlers(): void {
  Object.keys(chatHubHandlers).forEach((event) => {
    const handler = chatHubHandlers[event];
    if (handler) {
      signalRService.off(event, handler);
      chatHubHandlers[event] = null;
    }
  });
}

function stopChatHeartbeat(): void {
  if (chatHeartbeatTimer) {
    clearInterval(chatHeartbeatTimer);
    chatHeartbeatTimer = null;
  }
}

/** Minimal shape of the SignalR weather alert payload. The server sends
 *  WeatherAlertId as the primary identifier, matching WeatherAlertResultData. */
interface WeatherAlertSignalRMessage {
  WeatherAlertId?: string;
  /** Fallback for servers that use a lower-camel field name. */
  alertId?: string;
}

function extractAlertId(message: unknown): string | undefined {
  if (message !== null && typeof message === 'object') {
    const m = message as WeatherAlertSignalRMessage;
    return m.WeatherAlertId ?? m.alertId;
  }
  return undefined;
}

/** Update-hub events that carry a per-event timestamp for targeted refetches. */
export const UPDATE_HUB_EVENTS = [
  'personnelStatusUpdated',
  'personnelStaffingUpdated',
  'unitStatusUpdated',
  'callsUpdated',
  'callAdded',
  'callClosed',
  'weatherAlertReceived',
  'weatherAlertUpdated',
  'weatherAlertExpired',
] as const;

export type UpdateHubEvent = (typeof UPDATE_HUB_EVENTS)[number];

interface SignalRState {
  isUpdateHubConnected: boolean;
  /** @deprecated Kept for backward compatibility — mirrors the latest update-hub message. */
  lastUpdateMessage: unknown;
  /** @deprecated Kept for backward compatibility — mirrors the latest update-hub timestamp. */
  lastUpdateTimestamp: number;
  /** Per-event timestamps — consumers should subscribe to the events they care about. */
  lastUpdateTimestamps: Record<string, number>;
  /** Raw payload of the latest unitStatusUpdated message (no JSON round-trip). */
  lastUnitStatusMessage: unknown;
  lastUnitStatusTimestamp: number;
  isGeolocationHubConnected: boolean;
  lastGeolocationMessage: unknown;
  lastGeolocationTimestamp: number;
  isChatHubConnected: boolean;
  error: Error | null;
  connectUpdateHub: () => Promise<void>;
  disconnectUpdateHub: () => Promise<void>;
  connectGeolocationHub: () => Promise<void>;
  disconnectGeolocationHub: () => Promise<void>;
  connectChatHub: () => Promise<void>;
  disconnectChatHub: () => Promise<void>;
}

/** Join the department group on the update hub. Group membership is per-
 *  connectionId, so this must run after every (re)connect. */
const joinDepartmentGroup = async (): Promise<void> => {
  const rawDepartmentId = securityStore.getState().rights?.DepartmentId;
  const departmentId = parseInt(rawDepartmentId ?? '', 10);

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    logger.error({
      message: 'Cannot join SignalR department group: invalid or missing DepartmentId',
      context: { rawDepartmentId },
    });
    return;
  }

  await signalRService.invoke(Env.CHANNEL_HUB_NAME, 'connect', departmentId);
};

export const useSignalRStore = create<SignalRState>((set, get) => ({
  isUpdateHubConnected: false,
  lastUpdateMessage: null,
  lastUpdateTimestamp: 0,
  lastUpdateTimestamps: {},
  lastUnitStatusMessage: null,
  lastUnitStatusTimestamp: 0,
  isGeolocationHubConnected: false,
  lastGeolocationMessage: null,
  lastGeolocationTimestamp: 0,
  isChatHubConnected: false,
  error: null,
  connectUpdateHub: async () => {
    try {
      if (get().isUpdateHubConnected) {
        return;
      }

      set({ isUpdateHubConnected: false, error: null });

      // Get the eventing URL from the core store config
      const coreState = useCoreStore.getState();
      const eventingUrl = coreState.config?.EventingUrl;

      if (!eventingUrl) {
        const errorMessage = 'EventingUrl not available in config. Please ensure config is loaded first.';
        logger.error({
          message: errorMessage,
        });
        set({ error: new Error(errorMessage) });
        return;
      }

      // Remove any previously registered handlers to prevent accumulation
      // across reconnections or repeated connectUpdateHub calls. Lifecycle
      // events use hub-scoped names so this never wipes the geo hub's listeners.
      const updateHubDisconnected = `${SignalRService.HUB_DISCONNECTED_EVENT}:${Env.CHANNEL_HUB_NAME}`;
      const updateHubReconnecting = `${SignalRService.HUB_RECONNECTING_EVENT}:${Env.CHANNEL_HUB_NAME}`;
      const updateHubReconnected = `${SignalRService.HUB_RECONNECTED_EVENT}:${Env.CHANNEL_HUB_NAME}`;
      const updateEvents = [...UPDATE_HUB_EVENTS, 'onConnected', updateHubDisconnected, updateHubReconnecting, updateHubReconnected];
      updateEvents.forEach((event) => signalRService.removeAllListeners(event));

      // Connect to the eventing hub
      await signalRService.connectToHubWithEventingUrl({
        name: Env.CHANNEL_HUB_NAME,
        eventingUrl: eventingUrl,
        hubName: Env.CHANNEL_HUB_NAME,
        methods: [...UPDATE_HUB_EVENTS, 'onConnected'],
      });

      await joinDepartmentGroup();

      // Connection lifecycle: clear the connected flag when the hub drops so
      // connectUpdateHub() can recover, and re-join the department group +
      // trigger a full state resync after every reconnect (group membership
      // is per-connectionId and events are missed while disconnected).
      signalRService.on(updateHubDisconnected, () => {
        set({ isUpdateHubConnected: false });
      });

      signalRService.on(updateHubReconnecting, () => {
        set({ isUpdateHubConnected: false });
      });

      signalRService.on(updateHubReconnected, () => {
        void (async () => {
          try {
            await joinDepartmentGroup();
            set({ isUpdateHubConnected: true, error: null });

            // Bump every event timestamp so subscribed hooks refetch their
            // data — events were missed while the connection was down.
            const now = Date.now();
            const timestamps: Record<string, number> = {};
            UPDATE_HUB_EVENTS.forEach((event) => {
              timestamps[event] = now;
            });
            set({ lastUpdateTimestamps: timestamps, lastUpdateTimestamp: now });

            logger.info({
              message: 'Re-joined department group and triggered state resync after SignalR reconnect',
            });
          } catch (error) {
            logger.error({
              message: 'Failed to re-join department group after SignalR reconnect',
              context: { error },
            });
          }
        })();
      });

      // One handler per event: record a per-event timestamp (no JSON.stringify
      // on the hot path) and keep the deprecated aggregate fields in sync for
      // legacy consumers.
      const recordEvent = (event: UpdateHubEvent) => (message: unknown) => {
        const now = Date.now();
        set((state) => ({
          lastUpdateMessage: message,
          lastUpdateTimestamp: now,
          lastUpdateTimestamps: { ...state.lastUpdateTimestamps, [event]: now },
        }));
      };

      signalRService.on('personnelStatusUpdated', recordEvent('personnelStatusUpdated'));
      signalRService.on('personnelStaffingUpdated', recordEvent('personnelStaffingUpdated'));
      signalRService.on('callsUpdated', recordEvent('callsUpdated'));
      signalRService.on('callAdded', recordEvent('callAdded'));
      signalRService.on('callClosed', recordEvent('callClosed'));

      // unitStatusUpdated additionally keeps its raw payload for the status hook
      signalRService.on('unitStatusUpdated', (message) => {
        const now = Date.now();
        set((state) => ({
          lastUpdateMessage: message,
          lastUpdateTimestamp: now,
          lastUpdateTimestamps: { ...state.lastUpdateTimestamps, unitStatusUpdated: now },
          lastUnitStatusMessage: message,
          lastUnitStatusTimestamp: now,
        }));
      });

      signalRService.on('weatherAlertReceived', (message) => {
        recordEvent('weatherAlertReceived')(message);
        const alertId = extractAlertId(message);
        if (alertId) {
          useWeatherAlertsStore.getState().handleAlertReceived(alertId);
        } else {
          logger.warn({ message: 'weatherAlertReceived: could not extract alertId from message', context: { message } });
        }
      });

      signalRService.on('weatherAlertUpdated', (message) => {
        recordEvent('weatherAlertUpdated')(message);
        const alertId = extractAlertId(message);
        if (alertId) {
          useWeatherAlertsStore.getState().handleAlertUpdated(alertId);
        } else {
          logger.warn({ message: 'weatherAlertUpdated: could not extract alertId from message', context: { message } });
        }
      });

      signalRService.on('weatherAlertExpired', (message) => {
        recordEvent('weatherAlertExpired')(message);
        const alertId = extractAlertId(message);
        if (alertId) {
          useWeatherAlertsStore.getState().handleAlertExpired(alertId);
        } else {
          logger.warn({ message: 'weatherAlertExpired: could not extract alertId from message', context: { message } });
        }
      });

      signalRService.on('onConnected', () => {
        logger.info({
          message: 'Connected to update SignalR hub',
        });
        set({ isUpdateHubConnected: true, error: null });
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.warn({
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
      logger.warn({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  connectGeolocationHub: async () => {
    try {
      if (get().isGeolocationHubConnected) {
        return;
      }

      set({ isGeolocationHubConnected: false, error: null });

      // Get the eventing URL from the core store config
      const coreState = useCoreStore.getState();
      const eventingUrl = coreState.config?.EventingUrl;

      if (!eventingUrl) {
        const errorMessage = 'EventingUrl not available in config. Please ensure config is loaded first.';
        logger.error({
          message: errorMessage,
        });
        set({ error: new Error(errorMessage) });
        return;
      }

      // Remove any previously registered handlers to prevent accumulation
      const geoHubDisconnected = `${SignalRService.HUB_DISCONNECTED_EVENT}:${Env.REALTIME_GEO_HUB_NAME}`;
      const geoEvents = ['onPersonnelLocationUpdated', 'onUnitLocationUpdated', 'onGeolocationConnect', geoHubDisconnected];
      geoEvents.forEach((event) => signalRService.removeAllListeners(event));

      // Connect to the geolocation hub
      await signalRService.connectToHubWithEventingUrl({
        name: Env.REALTIME_GEO_HUB_NAME,
        eventingUrl: eventingUrl,
        hubName: Env.REALTIME_GEO_HUB_NAME,
        methods: ['onPersonnelLocationUpdated', 'onUnitLocationUpdated', 'onGeolocationConnect'],
      });

      // NOTE: no per-message store writes here. Geolocation messages fire per
      // unit per location cycle and nothing in the app consumes them — writing
      // them to the store (previously JSON.stringify'd on every message) was
      // pure CPU/render churn. Register no-op listeners so the hub methods stay
      // subscribed without store updates.
      signalRService.on('onPersonnelLocationUpdated', () => {});
      signalRService.on('onUnitLocationUpdated', () => {});

      signalRService.on(geoHubDisconnected, () => {
        set({ isGeolocationHubConnected: false });
      });

      signalRService.on('onGeolocationConnect', () => {
        logger.info({
          message: 'Connected to geolocation SignalR hub',
        });
        set({ isGeolocationHubConnected: true, error: null });
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.warn({
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
      logger.warn({
        message: 'Failed to disconnect from SignalR hubs',
        context: { error: err },
      });
      set({ error: err });
    }
  },
  connectChatHub: async () => {
    try {
      // Guard here so every call path (init, app-resume reconnect) honors the flag.
      if (!featureFlagsStore.getState().isEnabled(FeatureFlagKeys.ChatSystem)) {
        logger.info({ message: 'Chat disabled by feature flag; skipping chat hub connection' });
        return;
      }

      if (get().isChatHubConnected) {
        return;
      }

      const eventingUrl = useCoreStore.getState().config?.EventingUrl;
      if (!eventingUrl) {
        logger.warn({ message: 'EventingUrl not available for chat hub, skipping connection' });
        return;
      }

      // Ensure any previous handlers are cleaned up before registering new ones.
      unregisterChatHubHandlers();

      await signalRService.connectToHubWithEventingUrl({
        name: Env.CHAT_HUB_NAME,
        eventingUrl,
        hubName: Env.CHAT_HUB_NAME,
        methods: CHAT_HUB_METHODS,
      });

      const chat = useChatStore.getState();
      const handlerMap: Record<string, (...args: unknown[]) => void> = {
        chatMessageReceived: chat.handleMessageReceived,
        chatMessageEdited: chat.handleMessageEdited,
        chatMessageDeleted: chat.handleMessageDeleted,
        chatReactionUpdated: chat.handleReactionUpdated,
        chatReceiptUpdated: chat.handleReceiptUpdated,
        chatChannelUpdated: chat.handleChannelUpdated,
        chatChannelProvisioned: chat.handleChannelProvisioned,
        chatModerationApplied: chat.handleModerationApplied,
        chatMessageAckRequired: chat.handleAckRequired,
        chatThreadUpdated: chat.handleThreadUpdated,
        chatbotMessageReceived: chat.handleChatbotMessageReceived,
        chatbotTyping: chat.handleChatbotTyping,
        chatTyping: chat.handleTyping,
        chatPresenceChanged: chat.handlePresenceChanged,
      };

      Object.entries(handlerMap).forEach(([event, handler]) => {
        const wrapped = (...args: unknown[]) => handler(...args);
        chatHubHandlers[event] = wrapped;
        signalRService.on(event, wrapped);
      });

      const onChatConnected = () => {
        logger.info({ message: 'Connected to chat SignalR hub' });
        set({ isChatHubConnected: true, error: null });
        useChatStore.getState().handleChatConnected();
      };
      chatHubHandlers.onChatConnected = onChatConnected;
      signalRService.on('onChatConnected', onChatConnected);

      // Announce chat presence to the hub, then begin the periodic heartbeat.
      await signalRService.invoke(Env.CHAT_HUB_NAME, 'Connect');
      set({ isChatHubConnected: true });

      stopChatHeartbeat();
      chatHeartbeatTimer = setInterval(() => {
        signalRService.invoke(Env.CHAT_HUB_NAME, 'Heartbeat').catch(() => {
          // Heartbeat is best-effort; ignore transient failures.
        });
      }, CHAT_HEARTBEAT_INTERVAL_MS);

      logger.info({ message: 'Chat hub handlers registered successfully' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({ message: 'Failed to connect to chat SignalR hub', context: { error: err } });
      set({ error: err });
    }
  },
  disconnectChatHub: async () => {
    try {
      stopChatHeartbeat();
      unregisterChatHubHandlers();
      await signalRService.disconnectFromHub(Env.CHAT_HUB_NAME);
      set({ isChatHubConnected: false });
      logger.info({ message: 'Chat hub disconnected and handlers cleaned up' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error({ message: 'Failed to disconnect from chat SignalR hub', context: { error: err } });
      set({ error: err });
    }
  },
}));
