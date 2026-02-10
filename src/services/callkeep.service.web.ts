/**
 * Web implementation of CallKeep service
 * Provides no-op implementations since browsers handle audio natively
 * and don't need CallKit/ConnectionService for background audio support
 */

import { logger } from '../lib/logging';

export interface CallKeepConfig {
  appName: string;
  maximumCallGroups: number;
  maximumCallsPerCallGroup: number;
  includesCallsInRecents: boolean;
  supportsVideo: boolean;
  ringtoneSound?: string;
}

export class CallKeepService {
  private static instance: CallKeepService | null = null;
  private muteStateCallback: ((muted: boolean) => void) | null = null;
  private endCallCallback: (() => void) | null = null;
  private isCallActive = false;
  private currentCallUUID: string | null = null;

  private constructor() {}

  static getInstance(): CallKeepService {
    if (!CallKeepService.instance) {
      CallKeepService.instance = new CallKeepService();
    }
    return CallKeepService.instance;
  }

  /**
   * Setup CallKeep - no-op on web
   */
  async setup(_config: CallKeepConfig): Promise<void> {
    logger.debug({
      message: 'CallKeep setup skipped - web platform handles audio natively',
    });
  }

  /**
   * Start a call - returns a mock UUID on web
   */
  async startCall(roomName: string, _handle?: string): Promise<string> {
    this.currentCallUUID = `web-call-${Date.now()}`;
    this.isCallActive = true;

    logger.debug({
      message: 'CallKeep web: started call (no-op)',
      context: { roomName, uuid: this.currentCallUUID },
    });

    return this.currentCallUUID;
  }

  /**
   * End the active call - no-op on web
   */
  async endCall(): Promise<void> {
    if (this.currentCallUUID) {
      logger.debug({
        message: 'CallKeep web: ended call (no-op)',
        context: { uuid: this.currentCallUUID },
      });

      this.currentCallUUID = null;
      this.isCallActive = false;

      // Trigger end call callback if registered
      if (this.endCallCallback) {
        this.endCallCallback();
      }
    }
  }

  /**
   * Set a callback to handle mute state changes
   * On web, this is managed by the UI directly, but we keep the callback for API compatibility
   */
  setMuteStateCallback(callback: ((muted: boolean) => void) | null): void {
    this.muteStateCallback = callback;
  }

  /**
   * Set a callback to handle end call events
   */
  setEndCallCallback(callback: (() => void) | null): void {
    this.endCallCallback = callback;
  }

  /**
   * Ignore mute events for a duration - no-op on web
   */
  ignoreMuteEvents(_durationMs: number): void {
    // No-op on web
  }

  /**
   * Check if there's an active call
   */
  isCallActiveNow(): boolean {
    return this.isCallActive && this.currentCallUUID !== null;
  }

  /**
   * Get the current call UUID
   */
  getCurrentCallUUID(): string | null {
    return this.currentCallUUID;
  }

  /**
   * Remove mute listener - no-op on web
   */
  removeMuteListener(): void {
    // No-op on web
  }

  /**
   * Restore mute listener - no-op on web
   */
  restoreMuteListener(): void {
    // No-op on web
  }

  /**
   * Clean up resources - minimal cleanup on web
   */
  async cleanup(): Promise<void> {
    if (this.isCallActive) {
      await this.endCall();
    }
    this.muteStateCallback = null;
    this.endCallCallback = null;

    logger.debug({
      message: 'CallKeep web: service cleaned up',
    });
  }
}

// Export singleton instance
export const callKeepService = CallKeepService.getInstance();
