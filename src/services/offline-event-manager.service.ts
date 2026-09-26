import axios from 'axios';
import { AppState, type AppStateStatus } from 'react-native';

import { saveCallImage } from '@/api/calls/callFiles';
import { performCheckIn } from '@/api/check-in-timers/check-in-timers';
import { setUnitLocation } from '@/api/units/unitLocation';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { logger } from '@/lib/logging';
import {
  type QueuedCallImageUploadEvent,
  type QueuedCheckInEvent,
  type QueuedEvent,
  QueuedEventStatus,
  QueuedEventType,
  type QueuedLocationUpdateEvent,
  type QueuedUnitStatusEvent,
} from '@/models/offline-queue/queued-event';
import { SaveUnitLocationInput } from '@/models/v4/unitLocation/saveUnitLocationInput';
import { SaveUnitStatusInput, SaveUnitStatusRoleInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import type * as ChecklistsStore from '@/stores/checklists/store';
import { setOfflineQueueActivityListener, useOfflineQueueStore } from '@/stores/offline-queue/store';
import { isNetworkError } from '@/utils/network';

/**
 * A replay the server refused outright. Sending the same payload again can only fail the same way,
 * so the event is parked as permanently failed instead of burning its retries.
 */
class NonRetryableEventError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'NonRetryableEventError';
  }
}

const getHttpStatus = (error: unknown): number | null => (axios.isAxiosError(error) && error.response ? error.response.status : null);

// 4xx the server will keep returning for the same payload. 401 runs through the client's token
// refresh and 408/429 are timeouts/throttling, so those stay retryable like network failures.
const isNonRetryableClientError = (status: number | null): status is number => status !== null && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;

/**
 * Still owed to the server: waiting, mid-send, or failed with retries left. A permanently failed
 * event is parked for the user to see, not something later statuses should wait behind.
 */
const isUndelivered = (event: QueuedEvent): boolean =>
  event.status === QueuedEventStatus.PENDING || event.status === QueuedEventStatus.PROCESSING || (event.status === QueuedEventStatus.FAILED && event.retryCount < event.maxRetries);

const isUndeliveredUnitStatusFor = (event: QueuedEvent, unitId: string): boolean => event.type === QueuedEventType.UNIT_STATUS && String(event.data?.unitId) === String(unitId) && isUndelivered(event);

interface ProcessEventOptions {
  /**
   * The crew is waiting on this delivery (it gates a status they just submitted). A connectivity
   * failure then says nothing about the event itself, so it goes back to pending with its retry
   * budget intact instead of burning a retry the background processor would have spent later.
   */
  interactive?: boolean;
}

class OfflineEventManager {
  private static instance: OfflineEventManager;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  // The batch currently replaying events, whether started by the timer or by a submitted status.
  // Only one may run at a time, or both would send the same event.
  private currentRun: Promise<void> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private readonly PROCESSING_INTERVAL = 10000; // 10 seconds
  private readonly MAX_CONCURRENT_EVENTS = 3;

  private constructor() {
    this.initializeAppStateListener();
  }

  static getInstance(): OfflineEventManager {
    if (!OfflineEventManager.instance) {
      OfflineEventManager.instance = new OfflineEventManager();
    }
    return OfflineEventManager.instance;
  }

  /**
   * Initialize the offline event manager
   */
  public initialize(): void {
    logger.info({
      message: 'Initializing offline event manager',
    });

    // Initialize network listener
    useOfflineQueueStore.getState().initializeNetworkListener();

    // The processing timer stops itself once the queue has no work left, so the
    // queue wakes it again when an event is enqueued, retried, or the device
    // comes back online.
    setOfflineQueueActivityListener(() => {
      if (AppState.currentState !== 'inactive') {
        this.startProcessing();
      }
    });

    // Start processing when app becomes active
    this.handleAppStateChange(AppState.currentState);
  }

  /**
   * True when the queue still holds something the processor can act on. Events
   * whose retries are exhausted are inert, so a queue holding only those must
   * not keep the 10s timer alive.
   */
  private hasPendingWork(): boolean {
    const store = useOfflineQueueStore.getState();

    if (store.getPendingEvents().length > 0) {
      return true;
    }

    // Events parked on a retry backoff are not pending *yet*, but they will be —
    // dropping the timer now would strand them until the next enqueue.
    return (store.queuedEvents ?? []).some((event) => event.status === QueuedEventStatus.PROCESSING || (event.status === QueuedEventStatus.FAILED && event.retryCount < event.maxRetries));
  }

  /**
   * Start background processing of queued events
   */
  public startProcessing(): void {
    if (this.processingInterval) {
      logger.debug({
        message: 'Event processing already running',
      });
      return;
    }

    // Nothing to drain — starting the timer here would just tick against an
    // empty queue until something is enqueued, which wakes it anyway.
    if (!this.hasPendingWork()) {
      logger.debug({
        message: 'Offline queue is empty, not starting event processing',
      });
      return;
    }

    logger.info({
      message: 'Starting offline event processing',
    });

    this.processingInterval = setInterval(() => {
      this.processQueuedEvents();
    }, this.PROCESSING_INTERVAL);

    // Process immediately on start
    this.processQueuedEvents();
  }

  /**
   * Stop background processing
   */
  public stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info({
        message: 'Stopped offline event processing',
      });
    }
  }

  /**
   * Add a unit status event to the queue
   */
  public queueUnitStatusEvent(
    unitId: string,
    statusType: string,
    note?: string,
    respondingTo?: string,
    respondingToType?: number | string | null,
    roles?: { roleId: string; userId: string }[],
    gpsData?: {
      latitude?: string;
      longitude?: string;
      accuracy?: string;
      altitude?: string;
      altitudeAccuracy?: string;
      speed?: string;
      heading?: string;
    },
    // When the crew set the status. Replays send this, so a queued status keeps its real time.
    recordedAt?: Date
  ): string {
    const date = recordedAt ?? new Date();
    const data = {
      unitId,
      statusType,
      note,
      respondingTo,
      respondingToType,
      timestamp: date.toISOString(),
      timestampUtc: date.toUTCString().replace('UTC', 'GMT'),
      roles,
      latitude: gpsData?.latitude,
      longitude: gpsData?.longitude,
      accuracy: gpsData?.accuracy,
      altitude: gpsData?.altitude,
      altitudeAccuracy: gpsData?.altitudeAccuracy,
      speed: gpsData?.speed,
      heading: gpsData?.heading,
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.UNIT_STATUS, data);
  }

  /**
   * Add a location update event to the queue
   */
  public queueLocationUpdateEvent(unitId: string, latitude: number, longitude: number, accuracy?: number, heading?: number, speed?: number): string {
    const data = {
      unitId,
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      timestamp: new Date().toISOString(),
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.LOCATION_UPDATE, data);
  }

  /**
   * Add a call image upload event to the queue
   */
  public queueCallImageUploadEvent(callId: string, userId: string, note: string, name: string, filePath: string, latitude?: number, longitude?: number): string {
    const data = {
      callId,
      userId,
      note,
      name,
      latitude,
      longitude,
      filePath,
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.CALL_IMAGE_UPLOAD, data);
  }

  /**
   * Add a check-in event to the queue
   */
  public queueCheckInEvent(callId: number, checkInType: number, unitId?: number, latitude?: string, longitude?: string, note?: string): string {
    const data = {
      callId,
      checkInType,
      unitId,
      latitude,
      longitude,
      note,
      timestamp: new Date().toISOString(),
    };

    return useOfflineQueueStore.getState().addEvent(QueuedEventType.CHECK_IN, data);
  }

  /**
   * Process check-in event
   */
  private async processCheckInEvent(event: QueuedCheckInEvent): Promise<void> {
    await performCheckIn({
      CallId: event.data.callId,
      CheckInType: event.data.checkInType,
      UnitId: event.data.unitId,
      Latitude: event.data.latitude,
      Longitude: event.data.longitude,
      Note: event.data.note,
    });
  }

  /**
   * Process queued events
   */
  private async processQueuedEvents(): Promise<void> {
    if (this.isProcessing) {
      logger.debug({
        message: 'Event processing already in progress, skipping',
      });
      return;
    }

    // Age out permanently failed events before deciding whether there is work
    // left — a queue holding only dead events is an idle queue.
    useOfflineQueueStore.getState().pruneFailedEvents();

    if (!this.hasPendingWork()) {
      // Nothing actionable: stop the timer instead of ticking every 10s forever.
      // addEvent / retry / NetInfo reconnect restart it via the activity listener.
      this.stopProcessing();
      return;
    }

    const store = useOfflineQueueStore.getState();

    // Don't process if offline. The timer stays armed so the queue drains as
    // soon as connectivity returns.
    if (!store.isConnected || !store.isNetworkReachable) {
      logger.debug({
        message: 'Device is offline, skipping event processing',
        context: { isConnected: store.isConnected, isNetworkReachable: store.isNetworkReachable },
      });
      return;
    }

    const pendingEvents = store.getPendingEvents();
    if (pendingEvents.length === 0) {
      return;
    }

    logger.info({
      message: 'Processing queued events',
      context: { eventCount: pendingEvents.length },
    });

    // Process events SEQUENTIALLY in creation order. Concurrent batches could
    // land two UNIT_STATUS/LOCATION events for the same unit out of order on
    // the server, showing a stale status/position as current.
    const eventsToProcess = [...pendingEvents].sort((a, b) => a.createdAt - b.createdAt).slice(0, this.MAX_CONCURRENT_EVENTS);

    await this.beginRun(async () => {
      try {
        for (const event of eventsToProcess) {
          await this.processEvent(event);
        }
      } catch (error) {
        logger.error({
          message: 'Error during batch event processing',
          context: { error },
        });
      }
    });
  }

  /**
   * Claim the processor for `task`. Callers must have checked `currentRun` is empty in the same
   * synchronous block — there is no await between that check and this claim, so nothing can slip in.
   */
  private beginRun(task: () => Promise<void>): Promise<void> {
    this.isProcessing = true;
    useOfflineQueueStore.getState()._setProcessing(true);

    const run = (async () => {
      try {
        await task();
      } finally {
        this.isProcessing = false;
        this.currentRun = null;
        useOfflineQueueStore.getState()._setProcessing(false);
      }
    })();

    this.currentRun = run;
    return run;
  }

  /**
   * True only when the device has no network interface at all, so a request cannot succeed.
   *
   * Deliberately ignores the reachability flag: it reads false while still unknown, and on networks
   * that block the reachability probe but reach Resgrid fine.
   */
  public isDeviceOffline(): boolean {
    return !useOfflineQueueStore.getState().isConnected;
  }

  /**
   * True when a unit status for this unit is still waiting to reach the server.
   *
   * The server takes a unit's most recently *inserted* state as current (not the latest
   * timestamp), so a newer status sent past one of these would be reverted when it replays.
   */
  public hasUndeliveredUnitStatuses(unitId: string): boolean {
    return (useOfflineQueueStore.getState().queuedEvents ?? []).some((event) => isUndeliveredUnitStatusFor(event, unitId));
  }

  /**
   * Send this unit's queued statuses now, oldest first, so a status the crew is submitting can
   * follow them instead of overtaking them.
   *
   * Runs regardless of the NetInfo reachability flag — the caller is about to hit the network
   * anyway, and reachability can read false on networks that reach Resgrid fine. Stops at the first
   * status that cannot be delivered to keep the order. Returns true when nothing for the unit is
   * still owed (delivered, or permanently rejected by the server), false otherwise.
   */
  public async deliverQueuedUnitStatuses(unitId: string): Promise<boolean> {
    // Let a batch the timer already started finish rather than replay its events a second time.
    // The loop re-checks after every wait, and the claim below follows it synchronously.
    while (this.currentRun) {
      await this.currentRun.catch(() => undefined);
    }

    let caughtUp = true;

    await this.beginRun(async () => {
      const events = (useOfflineQueueStore.getState().queuedEvents ?? []).filter((event) => isUndeliveredUnitStatusFor(event, unitId)).sort((a, b) => a.createdAt - b.createdAt);

      for (const event of events) {
        await this.processEvent(event, { interactive: true });

        const after = useOfflineQueueStore.getState().getEventById(event.id);
        if (after && isUndelivered(after)) {
          caughtUp = false;
          return;
        }
      }
    });

    return caughtUp;
  }

  /**
   * Process a single event
   */
  private async processEvent(event: QueuedEvent, options: ProcessEventOptions = {}): Promise<void> {
    const store = useOfflineQueueStore.getState();

    logger.debug({
      message: 'Processing event',
      context: { eventId: event.id, type: event.type },
    });

    store.updateEventStatus(event.id, QueuedEventStatus.PROCESSING);

    try {
      switch (event.type) {
        case QueuedEventType.CHECKLIST_COMPLETION: {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { flushChecklistDraft } = require('@/stores/checklists/store') as typeof ChecklistsStore;
          if (typeof event.data.scope !== 'string' || typeof event.data.id !== 'string') throw new Error('checklist_invalid_reference');
          await flushChecklistDraft(event.data.scope, event.data.id);
          break;
        }
        case QueuedEventType.UNIT_STATUS:
          await this.processUnitStatusEvent(event as QueuedUnitStatusEvent);
          break;
        case QueuedEventType.LOCATION_UPDATE:
          await this.processLocationUpdateEvent(event as QueuedLocationUpdateEvent);
          break;
        case QueuedEventType.CALL_IMAGE_UPLOAD:
          await this.processCallImageUploadEvent(event as QueuedCallImageUploadEvent);
          break;
        case QueuedEventType.CHECK_IN:
          await this.processCheckInEvent(event as QueuedCheckInEvent);
          break;
        default:
          throw new Error(`Unknown event type: ${event.type}`);
      }

      // Mark as completed and remove from queue
      store.updateEventStatus(event.id, QueuedEventStatus.COMPLETED);

      // Clean up completed events after a delay to avoid immediate removal
      setTimeout(() => {
        store.removeEvent(event.id);
      }, 1000);

      logger.info({
        message: 'Event processed successfully',
        context: { eventId: event.id, type: event.type },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof NonRetryableEventError) {
        // Stop here rather than looping on a payload the server will never accept.
        store.updateEventStatus(event.id, QueuedEventStatus.FAILED, errorMessage, { permanent: true });

        logger.error({
          message: 'Queued event rejected by server, not retrying',
          context: { eventId: event.id, type: event.type, status: error.status, error: errorMessage },
        });
        return;
      }

      if (options.interactive && isNetworkError(error)) {
        store.updateEventStatus(event.id, QueuedEventStatus.PENDING, errorMessage);

        logger.warn({
          message: 'Queued event could not be delivered ahead of a new submission, left pending',
          context: { eventId: event.id, type: event.type, error: errorMessage },
        });
        return;
      }

      store.updateEventStatus(event.id, QueuedEventStatus.FAILED, errorMessage);

      logger.error({
        message: 'Failed to process event',
        context: { eventId: event.id, type: event.type, error: errorMessage },
      });
    }
  }

  /**
   * Process unit status event
   */
  private async processUnitStatusEvent(event: QueuedUnitStatusEvent): Promise<void> {
    const input = new SaveUnitStatusInput();
    input.Id = event.data.unitId;
    input.Type = event.data.statusType;
    input.Note = event.data.note || '';
    input.RespondingTo = event.data.respondingTo || '0';
    input.RespondingToType = event.data.respondingToType == null || event.data.respondingToType === '' ? null : Number(event.data.respondingToType);
    input.Timestamp = event.data.timestamp;
    input.TimestampUtc = event.data.timestampUtc;

    // Always set GPS coordinates (even if empty)
    if (event.data.latitude && event.data.longitude) {
      input.Latitude = event.data.latitude;
      input.Longitude = event.data.longitude;
      input.Accuracy = event.data.accuracy || '0';
      input.Altitude = event.data.altitude || '0';
      input.AltitudeAccuracy = event.data.altitudeAccuracy || '0';
      input.Speed = event.data.speed || '0';
      input.Heading = event.data.heading || '0';
    } else {
      // Set empty strings when GPS data is not available
      input.Latitude = '';
      input.Longitude = '';
      input.Accuracy = '';
      input.Altitude = '';
      input.AltitudeAccuracy = '';
      input.Speed = '';
      input.Heading = '';
    }

    if (event.data.roles) {
      input.Roles = event.data.roles.map((role) => {
        const roleInput = new SaveUnitStatusRoleInput();
        roleInput.RoleId = role.roleId;
        roleInput.UserId = role.userId;
        return roleInput;
      });
    }

    try {
      await saveUnitStatus(input);
    } catch (error) {
      const status = getHttpStatus(error);
      const hasDestination = !!input.RespondingTo && input.RespondingTo !== '0';

      if (status !== 400 || !hasDestination) {
        throw this.toReplayError(error, event);
      }

      // SaveUnitStatus rejects the whole status with 400 when its destination is no longer valid —
      // typically the call closed before the queue drained. The status and the time it happened
      // still belong on the unit's timeline, so replay it once without the destination (keeping the
      // original timestamp) instead of retrying a payload that can never succeed and then dropping it.
      logger.warn({
        message: 'Queued unit status rejected for its destination, replaying without destination',
        context: { eventId: event.id, unitId: input.Id, statusType: input.Type, respondingTo: input.RespondingTo, respondingToType: input.RespondingToType },
      });

      const withoutDestination: SaveUnitStatusInput = { ...input, RespondingTo: '0', RespondingToType: null };

      try {
        await saveUnitStatus(withoutDestination);
      } catch (fallbackError) {
        throw this.toReplayError(fallbackError, event);
      }
    }
  }

  /** Classify a failed unit status replay: permanent server rejections stop retrying. */
  private toReplayError(error: unknown, event: QueuedUnitStatusEvent): unknown {
    const status = getHttpStatus(error);

    if (!isNonRetryableClientError(status)) {
      // Network failures, 5xx and auth/throttling keep the normal retry-with-backoff.
      return error;
    }

    // processEvent logs it and parks the event as permanently failed.
    return new NonRetryableEventError(`Unit status ${event.data.statusType} for unit ${event.data.unitId} rejected by server (HTTP ${status})`, status);
  }

  /**
   * Process location update event
   */
  private async processLocationUpdateEvent(event: QueuedLocationUpdateEvent): Promise<void> {
    const input = new SaveUnitLocationInput();
    input.UnitId = event.data.unitId;
    input.Latitude = event.data.latitude.toString();
    input.Longitude = event.data.longitude.toString();
    input.Accuracy = event.data.accuracy?.toString() || '';
    input.Heading = event.data.heading?.toString() || '';
    input.Speed = event.data.speed?.toString() || '';
    input.Timestamp = event.data.timestamp;

    await setUnitLocation(input);
  }

  /**
   * Process call image upload event
   */
  private async processCallImageUploadEvent(event: QueuedCallImageUploadEvent): Promise<void> {
    await saveCallImage(event.data.callId, event.data.userId, event.data.note, event.data.name, event.data.latitude ?? null, event.data.longitude ?? null, event.data.filePath);
  }

  /**
   * Initialize app state listener to start/stop processing
   */
  private initializeAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    logger.info({
      message: 'Offline event manager handling app state change',
      context: { nextAppState },
    });

    if (nextAppState === 'active') {
      this.startProcessing();
    } else if (nextAppState === 'background') {
      // Keep processing in background for a short time
      setTimeout(() => {
        if (AppState.currentState === 'background') {
          this.stopProcessing();
        }
      }, 30000); // 30 seconds
    } else if (nextAppState === 'inactive') {
      this.stopProcessing();
    }
  };

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopProcessing();
    setOfflineQueueActivityListener(null);

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    logger.info({
      message: 'Offline event manager cleaned up',
    });
  }

  /**
   * Get processing statistics
   */
  public getStats(): {
    isProcessing: boolean;
    totalEvents: number;
    pendingEvents: number;
    failedEvents: number;
    completedEvents: number;
  } {
    const store = useOfflineQueueStore.getState();

    return {
      isProcessing: this.isProcessing,
      totalEvents: store.totalEvents,
      pendingEvents: store.getPendingEvents().length,
      failedEvents: store.getFailedEvents().length,
      completedEvents: store.completedEvents,
    };
  }

  /**
   * Retry all failed events
   */
  public retryFailedEvents(): void {
    useOfflineQueueStore.getState().retryAllFailedEvents();

    // Trigger processing immediately
    this.processQueuedEvents();
  }

  /**
   * Clear completed events
   */
  public clearCompletedEvents(): void {
    useOfflineQueueStore.getState().clearCompletedEvents();
  }
}

// Export singleton instance
export const offlineEventManager = OfflineEventManager.getInstance();
