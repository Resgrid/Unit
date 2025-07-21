import { cleanup } from '@testing-library/react-native';
import { Asset } from 'expo-asset';
import { type AudioPlayer, createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { string } from 'zod';

import { logger } from '@/lib/logging';

class AudioService {
  private static instance: AudioService;
  private startTransmittingSound: AudioPlayer | null = null;
  private stopTransmittingSound: AudioPlayer | null = null;
  private connectedDeviceSound: AudioPlayer | null = null;
  private connectToAudioRoomSound: AudioPlayer | null = null;
  private disconnectedFromAudioRoomSound: AudioPlayer | null = null;

  private constructor() {
    this.initializeAudio();
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  private async initializeAudio(): Promise<void> {
    try {
      // Pre-load audio files
      await this.loadAudioFiles();

      logger.info({
        message: 'Audio service initialized',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize audio service',
        context: { error },
      });
    }
  }

  public async preloadAudioAssets(): Promise<void> {
    try {
      await Promise.all([
        Asset.loadAsync(require('@assets/audio/ui/space_notification1.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/space_notification2.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/positive_interface_beep.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/software_interface_start.mp3')),
        Asset.loadAsync(require('@assets/audio/ui/software_interface_back.mp3')),
      ]);
      console.log('Audio assets preloaded successfully');
    } catch (error) {
      console.error('Error preloading audio assets:', error);
    }
  }

  private async loadAudioFiles(): Promise<void> {
    try {
      // Load connection sound
      const connectionSoundUri = Platform.select({
        ios: require('@assets/audio/ui/space_notification1.mp3'),
        android: require('@assets/audio/ui/space_notification1.mp3'),
      });

      if (connectionSoundUri) {
        this.startTransmittingSound = createAudioPlayer(connectionSoundUri);
      }

      // Load disconnection sound
      const disconnectionSoundUri = Platform.select({
        ios: require('@assets/audio/ui/space_notification2.mp3'),
        android: require('@assets/audio/ui/space_notification2.mp3'),
      });

      if (disconnectionSoundUri) {
        this.stopTransmittingSound = createAudioPlayer(disconnectionSoundUri);
      }

      // Load connection sound
      const connectedDeviceSoundUri = Platform.select({
        ios: require('@assets/audio/ui/positive_interface_beep.mp3'),
        android: require('@assets/audio/ui/positive_interface_beep.mp3'),
      });

      if (connectedDeviceSoundUri) {
        this.connectedDeviceSound = createAudioPlayer(connectedDeviceSoundUri);
      }

      const connectedToAudioRoomSoundUri = Platform.select({
        ios: require('@assets/audio/ui/software_interface_start.mp3'),
        android: require('@assets/audio/ui/software_interface_start.mp3'),
      });

      if (connectedToAudioRoomSoundUri) {
        this.connectToAudioRoomSound = createAudioPlayer(connectedToAudioRoomSoundUri);
      }

      const disconnectedFromAudioRoomSoundUri = Platform.select({
        ios: require('@assets/audio/ui/software_interface_back.mp3'),
        android: require('@assets/audio/ui/software_interface_back.mp3'),
      });

      if (disconnectedFromAudioRoomSoundUri) {
        this.disconnectedFromAudioRoomSound = createAudioPlayer(disconnectedFromAudioRoomSoundUri);
      }

      logger.debug({
        message: 'Audio files loaded successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to load audio files',
        context: { error },
      });
    }
  }

  private async playSound(sound: AudioPlayer | null, soundName: string): Promise<void> {
    try {
      if (!sound) {
        logger.warn({
          message: `Sound not loaded: ${soundName}`,
        });
        return;
      }

      // In expo-audio, we use play() method
      await sound.seekTo(0); // Reset to start
      sound.play();

      logger.debug({
        message: 'Sound played successfully',
        context: { soundName },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play sound',
        context: { soundName, error },
      });
    }
  }

  async playStartTransmittingSound(): Promise<void> {
    try {
      await this.playSound(this.startTransmittingSound, 'startTransmitting');
    } catch (error) {
      logger.error({
        message: 'Failed to play start transmitting sound',
        context: { error },
      });
    }
  }

  async playStopTransmittingSound(): Promise<void> {
    try {
      await this.playSound(this.stopTransmittingSound, 'stopTransmitting');
    } catch (error) {
      logger.error({
        message: 'Failed to play stop transmitting sound',
        context: { error },
      });
    }
  }

  async playConnectedDeviceSound(): Promise<void> {
    try {
      await this.playSound(this.connectedDeviceSound, 'connectedDevice');
    } catch (error) {
      logger.error({
        message: 'Failed to play connected device sound',
        context: { error },
      });
    }
  }

  async playConnectToAudioRoomSound(): Promise<void> {
    try {
      await this.playSound(this.connectToAudioRoomSound, 'connectedToAudioRoom');
    } catch (error) {
      logger.error({
        message: 'Failed to play connected to audio room sound',
        context: { error },
      });
    }
  }

  async playDisconnectedFromAudioRoomSound(): Promise<void> {
    try {
      await this.playSound(this.disconnectedFromAudioRoomSound, 'disconnectedFromAudioRoom');
    } catch (error) {
      logger.error({
        message: 'Failed to play disconnected from audio room sound',
        context: { error },
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Remove connection sound
      if (this.startTransmittingSound) {
        this.startTransmittingSound.remove();
        this.startTransmittingSound = null;
      }

      // Remove disconnection sound
      if (this.stopTransmittingSound) {
        this.stopTransmittingSound.remove();
        this.stopTransmittingSound = null;
      }

      // Remove connected device sound
      if (this.connectedDeviceSound) {
        this.connectedDeviceSound.remove();
        this.connectedDeviceSound = null;
      }

      // Remove connect to audio room sound
      if (this.connectToAudioRoomSound) {
        this.connectToAudioRoomSound.remove();
        this.connectToAudioRoomSound = null;
      }

      // Remove disconnected from audio room sound
      if (this.disconnectedFromAudioRoomSound) {
        this.disconnectedFromAudioRoomSound.remove();
        this.disconnectedFromAudioRoomSound = null;
      }

      logger.info({
        message: 'Audio service cleaned up',
      });
    } catch (error) {
      logger.error({
        message: 'Error during audio service cleanup',
        context: { error },
      });
    }
  }
}

export const audioService = AudioService.getInstance();
