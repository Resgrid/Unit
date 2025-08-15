import { type HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import useAuthStore from '@/stores/auth/store';

export interface SignalRHubConfig {
  name: string;
  url: string;
  methods: string[];
}

export interface SignalRHubConnectConfig {
  name: string;
  eventingUrl: string; // Base EventingUrl from config (trailing slash will be added if missing)
  hubName: string;
  methods: string[];
}

export interface SignalRMessage {
  type: string;
  data: unknown;
}

class SignalRService {
  private connections: Map<string, HubConnection> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private hubConfigs: Map<string, SignalRHubConnectConfig> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000; // 5 seconds

  private static instance: SignalRService;

  private constructor() {}

  public static getInstance(): SignalRService {
    if (!SignalRService.instance) {
      SignalRService.instance = new SignalRService();
    }
    return SignalRService.instance;
  }

  public async connectToHubWithEventingUrl(config: SignalRHubConnectConfig): Promise<void> {
    try {
      if (this.connections.has(config.name)) {
        logger.info({
          message: `Already connected to hub: ${config.name}`,
        });
        return;
      }

      const token = useAuthStore.getState().accessToken;
      if (!token) {
        throw new Error('No authentication token available');
      }

      if (!config.eventingUrl) {
        throw new Error('EventingUrl is required for SignalR connection');
      }

      // Ensure EventingUrl has a trailing slash
      const normalizedEventingUrl = config.eventingUrl.endsWith('/') ? config.eventingUrl : `${config.eventingUrl}/`;

      let fullUrl = `${normalizedEventingUrl}${config.hubName}`;

      // For geolocation hub, add token as URL parameter instead of header
      const isGeolocationHub = config.hubName === Env.REALTIME_GEO_HUB_NAME;
      if (isGeolocationHub) {
        const separator = fullUrl.includes('?') ? '&' : '?';
        fullUrl = `${fullUrl}${separator}access_token=${encodeURIComponent(token)}`;
      }

      logger.info({
        message: `Connecting to hub: ${config.name}`,
        context: { config, fullUrl: isGeolocationHub ? fullUrl.replace(/access_token=[^&]+/, 'access_token=***') : fullUrl },
      });

      // Store the config for potential reconnections
      this.hubConfigs.set(config.name, config);

      const connectionBuilder = new HubConnectionBuilder()
        .withUrl(
          fullUrl,
          isGeolocationHub
            ? {}
            : {
                accessTokenFactory: () => token,
              }
        )
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Information);

      const connection = connectionBuilder.build();

      // Set up event handlers
      connection.onclose(() => {
        this.handleConnectionClose(config.name);
      });

      connection.onreconnecting((error) => {
        logger.warn({
          message: `Reconnecting to hub: ${config.name}`,
          context: { error },
        });
      });

      connection.onreconnected((connectionId) => {
        logger.info({
          message: `Reconnected to hub: ${config.name}`,
          context: { connectionId },
        });
        this.reconnectAttempts.set(config.name, 0);
      });

      // Register all methods
      config.methods.forEach((method) => {
        logger.info({
          message: `Registering ${method} message from hub: ${config.name}`,
          context: { method },
        });

        connection.on(method, (data) => {
          logger.info({
            message: `Received ${method} message from hub: ${config.name}`,
            context: { method, data },
          });
          this.handleMessage(config.name, method, data);
        });
      });

      await connection.start();
      this.connections.set(config.name, connection);
      this.reconnectAttempts.set(config.name, 0);

      logger.info({
        message: `Connected to hub: ${config.name}`,
      });
    } catch (error) {
      logger.error({
        message: `Failed to connect to hub: ${config.name}`,
        context: { error },
      });
      throw error;
    }
  }

  public async connectToHub(config: SignalRHubConfig): Promise<void> {
    try {
      if (this.connections.has(config.name)) {
        logger.info({
          message: `Already connected to hub: ${config.name}`,
        });
        return;
      }

      const token = useAuthStore.getState().accessToken;
      if (!token) {
        throw new Error('No authentication token available');
      }

      logger.info({
        message: `Connecting to hub: ${config.name}`,
        context: { config },
      });

      const connection = new HubConnectionBuilder()
        .withUrl(config.url, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Information)
        .build();

      // Set up event handlers
      connection.onclose(() => {
        this.handleConnectionClose(config.name);
      });

      connection.onreconnecting((error) => {
        logger.warn({
          message: `Reconnecting to hub: ${config.name}`,
          context: { error },
        });
      });

      connection.onreconnected((connectionId) => {
        logger.info({
          message: `Reconnected to hub: ${config.name}`,
          context: { connectionId },
        });
        this.reconnectAttempts.set(config.name, 0);
      });

      // Register all methods
      config.methods.forEach((method) => {
        logger.info({
          message: `Registering ${method} message from hub: ${config.name}`,
          context: { method },
        });

        connection.on(method, (data) => {
          logger.info({
            message: `Received ${method} message from hub: ${config.name}`,
            context: { method, data },
          });
          this.handleMessage(config.name, method, data);
        });
      });

      await connection.start();
      this.connections.set(config.name, connection);
      this.reconnectAttempts.set(config.name, 0);

      logger.info({
        message: `Connected to hub: ${config.name}`,
      });
    } catch (error) {
      logger.error({
        message: `Failed to connect to hub: ${config.name}`,
        context: { error },
      });
      throw error;
    }
  }

  private handleConnectionClose(hubName: string): void {
    const attempts = this.reconnectAttempts.get(hubName) || 0;
    if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts.set(hubName, attempts + 1);

      const hubConfig = this.hubConfigs.get(hubName);
      if (hubConfig) {
        setTimeout(() => {
          this.connectToHubWithEventingUrl(hubConfig);
        }, this.RECONNECT_INTERVAL);
      } else {
        logger.error({
          message: `No stored config found for hub: ${hubName}`,
        });
      }
    } else {
      logger.error({
        message: `Max reconnection attempts reached for hub: ${hubName}`,
      });
    }
  }

  private handleMessage(hubName: string, method: string, data: unknown): void {
    logger.debug({
      message: `Received message from hub: ${hubName}`,
      context: { method, data },
    });
    // Emit event for subscribers using the method name as the event name
    this.emit(method, data);
  }

  public async disconnectFromHub(hubName: string): Promise<void> {
    const connection = this.connections.get(hubName);
    if (connection) {
      try {
        await connection.stop();
        this.connections.delete(hubName);
        this.reconnectAttempts.delete(hubName);
        this.hubConfigs.delete(hubName);
        logger.info({
          message: `Disconnected from hub: ${hubName}`,
        });
      } catch (error) {
        logger.error({
          message: `Error disconnecting from hub: ${hubName}`,
          context: { error },
        });
        throw error;
      }
    }
  }

  public async invoke(hubName: string, method: string, data: unknown): Promise<void> {
    const connection = this.connections.get(hubName);
    if (connection) {
      try {
        return await connection.invoke(method, data);
      } catch (error) {
        logger.error({
          message: `Error invoking method ${method} from hub: ${hubName}`,
          context: { error },
        });
        throw error;
      }
    }
  }

  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map((hubName) => this.disconnectFromHub(hubName));
    await Promise.all(disconnectPromises);
  }

  // Event emitter methods
  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();

  public on(event: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  public off(event: string, callback: (data: unknown) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(data));
  }
}

export const signalRService = SignalRService.getInstance();
