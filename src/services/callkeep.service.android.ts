import { logger } from '../lib/logging';

export interface CallKeepConfig {
  appName: string;
  maximumCallGroups: number;
  maximumCallsPerCallGroup: number;
  includesCallsInRecents: boolean;
  supportsVideo: boolean;
  ringtoneSound?: string;
}

/**
 * No-op implementation of CallKeepService for Android
 * CallKeep functionality is only supported on iOS
 */
export class CallKeepService {
  private static instance: CallKeepService | null = null;

  private constructor() {}

  static getInstance(): CallKeepService {
    if (!CallKeepService.instance) {
      CallKeepService.instance = new CallKeepService();
    }
    return CallKeepService.instance;
  }

  async setup(_config: CallKeepConfig): Promise<void> {
    logger.debug({
      message: 'CallKeep setup skipped - not supported on Android',
    });
  }

  async startCall(_roomName: string, _handle?: string): Promise<string> {
    logger.debug({
      message: 'CallKeep startCall skipped - not supported on Android',
    });
    return '';
  }

  async endCall(): Promise<void> {
    logger.debug({
      message: 'CallKeep endCall skipped - not supported on Android',
    });
  }

  setMuteStateCallback(_callback: ((muted: boolean) => void) | null): void {
    logger.debug({
      message: 'CallKeep setMuteStateCallback skipped - not supported on Android',
    });
  }

  isCallActiveNow(): boolean {
    return false;
  }

  getCurrentCallUUID(): string | null {
    return null;
  }

  async cleanup(): Promise<void> {
    logger.debug({
      message: 'CallKeep cleanup skipped - not supported on Android',
    });
  }
}

// Export singleton instance
export const callKeepService = CallKeepService.getInstance();
