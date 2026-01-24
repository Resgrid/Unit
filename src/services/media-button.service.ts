import { DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { logger } from '@/lib/logging';
import { audioService } from '@/services/audio.service';
import { type AudioButtonEvent, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import {
  createDefaultPTTSettings,
  type MediaButtonPTTSettings,
  type PTTMode,
} from '@/types/ptt';

// Re-export PTT types for backwards compatibility
export { type MediaButtonPTTSettings, type PTTMode };

// Lazy import to break dependency cycle with livekit-store
const getLiveKitStore = () => require('@/stores/app/livekit-store').useLiveKitStore;

// Media button event types
export type MediaButtonEventType = 'play' | 'pause' | 'playPause' | 'stop' | 'next' | 'previous' | 'togglePlayPause';

export interface MediaButtonEvent {
  type: MediaButtonEventType;
  timestamp: number;
  source?: 'airpods' | 'bluetooth_earbuds' | 'wired_headset' | 'unknown';
}

// Try to get the native module (will be null if not installed)
const { MediaButtonModule } = NativeModules;

class MediaButtonService {
  private static instance: MediaButtonService;
  private isInitialized = false;
  private eventListeners: { remove: () => void }[] = [];
  private settings: MediaButtonPTTSettings = createDefaultPTTSettings();
  private lastPressTimestamp: number = 0;
  private doubleTapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSingleTap: boolean = false;

  private constructor() {}

  static getInstance(): MediaButtonService {
    if (!MediaButtonService.instance) {
      MediaButtonService.instance = new MediaButtonService();
    }
    return MediaButtonService.instance;
  }

  /**
   * Initialize the media button service
   * Sets up event listeners for media button presses from AirPods/earbuds
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug({
        message: 'Media button service already initialized',
      });
      return;
    }

    try {
      logger.info({
        message: 'Initializing Media Button Service for AirPods/earbuds PTT support',
      });

      this.setupEventListeners();
      this.isInitialized = true;

      logger.info({
        message: 'Media Button Service initialized successfully',
        context: { platform: Platform.OS },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize Media Button Service',
        context: { error },
      });
      throw error;
    }
  }

  /**
   * Setup event listeners for media button events
   * On iOS: Uses MPRemoteCommandCenter via native module or CallKeep
   * On Android: Uses MediaSession via native module
   */
  private setupEventListeners(): void {
    if (Platform.OS === 'ios') {
      this.setupIOSEventListeners();
    } else if (Platform.OS === 'android') {
      this.setupAndroidEventListeners();
    }
  }

  /**
   * Setup iOS-specific event listeners
   * iOS AirPods/earbuds send media control events through MPRemoteCommandCenter
   */
  private setupIOSEventListeners(): void {
    // If native module is available, use it
    if (MediaButtonModule) {
      const eventEmitter = new NativeEventEmitter(MediaButtonModule);

      const playPauseListener = eventEmitter.addListener('onMediaButtonPlayPause', () => {
        this.handleMediaButtonEvent('playPause');
      });
      this.eventListeners.push(playPauseListener);

      const playListener = eventEmitter.addListener('onMediaButtonPlay', () => {
        this.handleMediaButtonEvent('play');
      });
      this.eventListeners.push(playListener);

      const pauseListener = eventEmitter.addListener('onMediaButtonPause', () => {
        this.handleMediaButtonEvent('pause');
      });
      this.eventListeners.push(pauseListener);

      const toggleListener = eventEmitter.addListener('onMediaButtonToggle', () => {
        this.handleMediaButtonEvent('togglePlayPause');
      });
      this.eventListeners.push(toggleListener);

      // Enable the native module to start receiving events
      MediaButtonModule.startListening?.();

      logger.debug({
        message: 'iOS media button listeners setup via native module',
      });
    } else {
      // Fallback: Use CallKeep mute events (already handled by CallKeep service)
      // This is a limited fallback since CallKeep only provides mute state changes
      // from the iOS Call UI, not from AirPods button presses directly
      logger.warn({
        message: 'MediaButtonModule not available on iOS - AirPods PTT may be limited',
        context: {
          suggestion: 'Install the MediaButtonModule native module for full AirPods PTT support',
        },
      });

      // We can still listen for generic audio session events through DeviceEventEmitter
      // Some libraries emit events that we can hook into
      const audioRouteListener = DeviceEventEmitter.addListener('audioRouteChanged', (event: { reason: string }) => {
        logger.debug({
          message: 'Audio route changed',
          context: { event },
        });
      });
      this.eventListeners.push(audioRouteListener);
    }
  }

  /**
   * Setup Android-specific event listeners
   * Android uses MediaSession callbacks for headset button events
   */
  private setupAndroidEventListeners(): void {
    if (MediaButtonModule) {
      const eventEmitter = new NativeEventEmitter(MediaButtonModule);

      // MediaSession callback events
      const mediaButtonListener = eventEmitter.addListener('onMediaButtonEvent', (event: { keyCode: number; action: string }) => {
        logger.debug({
          message: 'Android media button event received',
          context: { event },
        });

        // Android KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE = 85
        // Android KeyEvent.KEYCODE_HEADSETHOOK = 79
        if (event.keyCode === 85 || event.keyCode === 79) {
          if (event.action === 'ACTION_DOWN') {
            this.handleMediaButtonEvent('playPause');
          }
        }
      });
      this.eventListeners.push(mediaButtonListener);

      // Enable the native module to start receiving events
      MediaButtonModule.startListening?.();

      logger.debug({
        message: 'Android media button listeners setup via native module',
      });
    } else {
      // Fallback: Listen via DeviceEventEmitter for any media button events
      // Some audio libraries emit these events
      logger.warn({
        message: 'MediaButtonModule not available on Android - earbuds PTT may be limited',
        context: {
          suggestion: 'Install the MediaButtonModule native module for full earbuds PTT support',
        },
      });

      // Generic headset hook event listener (some libraries emit this)
      const headsetListener = DeviceEventEmitter.addListener('headsetButtonPressed', () => {
        this.handleMediaButtonEvent('playPause');
      });
      this.eventListeners.push(headsetListener);
    }
  }

  /**
   * Handle a media button event and convert it to PTT action
   */
  private handleMediaButtonEvent(type: MediaButtonEventType): void {
    if (!this.settings.enabled) {
      logger.debug({
        message: 'Media button PTT is disabled, ignoring event',
        context: { type },
      });
      return;
    }

    const now = Date.now();

    logger.info({
      message: 'Media button event received',
      context: { type, settings: this.settings },
    });

    // Handle double-tap detection
    if (this.settings.doubleTapAction !== 'none') {
      const timeSinceLastPress = now - this.lastPressTimestamp;

      if (timeSinceLastPress < this.settings.doubleTapTimeoutMs && this.pendingSingleTap) {
        // This is a double tap
        this.pendingSingleTap = false;
        if (this.doubleTapTimer) {
          clearTimeout(this.doubleTapTimer);
          this.doubleTapTimer = null;
        }

        logger.info({
          message: 'Double-tap detected on media button',
        });

        this.handleDoubleTap();
        this.lastPressTimestamp = now;
        return;
      }

      // Potential single tap - wait to see if it becomes a double tap
      this.lastPressTimestamp = now;
      this.pendingSingleTap = true;

      this.doubleTapTimer = setTimeout(() => {
        if (this.pendingSingleTap) {
          this.pendingSingleTap = false;
          this.handleSingleTap(type);
        }
      }, this.settings.doubleTapTimeoutMs);
    } else {
      // No double-tap detection, handle immediately
      this.handleSingleTap(type);
    }
  }

  /**
   * Handle single tap action based on PTT mode
   */
  private handleSingleTap(type: MediaButtonEventType): void {
    // Only handle play/pause type events for PTT
    if (!this.settings.usePlayPauseForPTT) {
      logger.debug({
        message: 'Play/Pause PTT disabled, ignoring',
        context: { type },
      });
      return;
    }

    if (type === 'playPause' || type === 'play' || type === 'pause' || type === 'togglePlayPause') {
      this.handlePTTAction();
    }
  }

  /**
   * Handle double tap action
   */
  private handleDoubleTap(): void {
    if (this.settings.doubleTapAction === 'toggle_mute') {
      this.handlePTTAction();
    }
  }

  /**
   * Execute the PTT action (toggle or push-to-talk based on mode)
   */
  private async handlePTTAction(): Promise<void> {
    const liveKitStore = getLiveKitStore().getState();

    if (!liveKitStore.currentRoom) {
      logger.debug({
        message: 'No active LiveKit room, cannot handle PTT action',
      });
      return;
    }

    try {
      const currentMicEnabled = liveKitStore.currentRoom.localParticipant.isMicrophoneEnabled;
      const newMicEnabled = !currentMicEnabled;

      await liveKitStore.currentRoom.localParticipant.setMicrophoneEnabled(newMicEnabled);

      // Create button event for store
      const buttonEvent: AudioButtonEvent = {
        type: 'press',
        button: newMicEnabled ? 'ptt_start' : 'ptt_stop',
        timestamp: Date.now(),
      };

      useBluetoothAudioStore.getState().addButtonEvent(buttonEvent);
      useBluetoothAudioStore.getState().setLastButtonAction({
        action: newMicEnabled ? 'unmute' : 'mute',
        timestamp: Date.now(),
      });

      // Play audio feedback
      if (newMicEnabled) {
        await audioService.playStartTransmittingSound();
      } else {
        await audioService.playStopTransmittingSound();
      }

      logger.info({
        message: 'PTT action executed via media button (AirPods/earbuds)',
        context: {
          micEnabled: newMicEnabled,
          pttMode: this.settings.pttMode,
        },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to execute PTT action via media button',
        context: { error },
      });
    }
  }

  /**
   * Enable microphone (for push-to-talk mode)
   */
  async enableMicrophone(): Promise<void> {
    const liveKitStore = getLiveKitStore().getState();

    if (!liveKitStore.currentRoom) {
      return;
    }

    const currentMicEnabled = liveKitStore.currentRoom.localParticipant.isMicrophoneEnabled;
    if (currentMicEnabled) {
      return; // Already enabled
    }

    try {
      await liveKitStore.currentRoom.localParticipant.setMicrophoneEnabled(true);

      useBluetoothAudioStore.getState().addButtonEvent({
        type: 'press',
        button: 'ptt_start',
        timestamp: Date.now(),
      });

      useBluetoothAudioStore.getState().setLastButtonAction({
        action: 'unmute',
        timestamp: Date.now(),
      });

      await audioService.playStartTransmittingSound();

      logger.info({
        message: 'Microphone enabled via media button',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to enable microphone via media button',
        context: { error },
      });
    }
  }

  /**
   * Disable microphone (for push-to-talk mode)
   */
  async disableMicrophone(): Promise<void> {
    const liveKitStore = getLiveKitStore().getState();

    if (!liveKitStore.currentRoom) {
      return;
    }

    const currentMicEnabled = liveKitStore.currentRoom.localParticipant.isMicrophoneEnabled;
    if (!currentMicEnabled) {
      return; // Already disabled
    }

    try {
      await liveKitStore.currentRoom.localParticipant.setMicrophoneEnabled(false);

      useBluetoothAudioStore.getState().addButtonEvent({
        type: 'press',
        button: 'ptt_stop',
        timestamp: Date.now(),
      });

      useBluetoothAudioStore.getState().setLastButtonAction({
        action: 'mute',
        timestamp: Date.now(),
      });

      await audioService.playStopTransmittingSound();

      logger.info({
        message: 'Microphone disabled via media button',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to disable microphone via media button',
        context: { error },
      });
    }
  }

  /**
   * Update PTT settings
   */
  updateSettings(settings: Partial<MediaButtonPTTSettings>): void {
    this.settings = { ...this.settings, ...settings };

    logger.info({
      message: 'Media button PTT settings updated',
      context: { settings: this.settings },
    });
  }

  /**
   * Get current PTT settings
   */
  getSettings(): MediaButtonPTTSettings {
    return { ...this.settings };
  }

  /**
   * Enable/disable media button PTT
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;

    logger.info({
      message: `Media button PTT ${enabled ? 'enabled' : 'disabled'}`,
    });
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if native module is available
   */
  isNativeModuleAvailable(): boolean {
    return MediaButtonModule !== null && MediaButtonModule !== undefined;
  }

  /**
   * Cleanup and destroy the service
   */
  destroy(): void {
    logger.info({
      message: 'Destroying Media Button Service',
    });

    // Clear any pending timers
    if (this.doubleTapTimer) {
      clearTimeout(this.doubleTapTimer);
      this.doubleTapTimer = null;
    }

    // Stop native module if available
    if (MediaButtonModule?.stopListening) {
      MediaButtonModule.stopListening();
    }

    // Remove all event listeners
    this.eventListeners.forEach((listener) => listener.remove());
    this.eventListeners = [];

    this.isInitialized = false;
    this.pendingSingleTap = false;
    this.lastPressTimestamp = 0;
  }
}

export const mediaButtonService = MediaButtonService.getInstance();
