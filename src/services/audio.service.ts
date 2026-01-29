import { Asset } from 'expo-asset';
import { Audio, InterruptionModeIOS } from 'expo-av';

import { logger } from '@/lib/logging';

class AudioService {
  private static instance: AudioService;

  // Use expo-av Sound objects
  private startTransmittingSound: Audio.Sound | null = null;
  private stopTransmittingSound: Audio.Sound | null = null;
  private connectedDeviceSound: Audio.Sound | null = null;
  private connectToAudioRoomSound: Audio.Sound | null = null;
  private disconnectedFromAudioRoomSound: Audio.Sound | null = null;

  private isInitialized = false;

  private constructor() {
    this.initializeAudio();
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  public async initialize(): Promise<void> {
    await this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Configure audio mode for production builds
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      });

      // Pre-load audio assets for production builds
      await this.preloadAudioAssets();

      // Load audio files
      await this.loadAudioFiles();

      this.isInitialized = true;

      logger.info({
        message: 'Audio service initialized successfully',
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

      logger.debug({
        message: 'Audio assets preloaded successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Error preloading audio assets',
        context: { error },
      });
    }
  }

  private async loadAudioFiles(): Promise<void> {
    try {
      // Load start transmitting sound
      const { sound: startSound } = await Audio.Sound.createAsync(require('@assets/audio/ui/space_notification1.mp3'));
      this.startTransmittingSound = startSound;

      // Load stop transmitting sound
      const { sound: stopSound } = await Audio.Sound.createAsync(require('@assets/audio/ui/space_notification2.mp3'));
      this.stopTransmittingSound = stopSound;

      // Load connected device sound
      const { sound: connectedSound } = await Audio.Sound.createAsync(require('@assets/audio/ui/positive_interface_beep.mp3'));
      this.connectedDeviceSound = connectedSound;

      // Load connect to audio room sound
      const { sound: connectRoomSound } = await Audio.Sound.createAsync(require('@assets/audio/ui/software_interface_start.mp3'));
      this.connectToAudioRoomSound = connectRoomSound;

      // Load disconnect from audio room sound
      const { sound: disconnectRoomSound } = await Audio.Sound.createAsync(require('@assets/audio/ui/software_interface_back.mp3'));
      this.disconnectedFromAudioRoomSound = disconnectRoomSound;

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

  async playStartTransmittingSound(): Promise<void> {
    try {
      if (this.startTransmittingSound) {
        await this.startTransmittingSound.replayAsync();
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play start transmitting sound',
        context: { error },
      });
    }
  }

  async playStopTransmittingSound(): Promise<void> {
    try {
      if (this.stopTransmittingSound) {
        await this.stopTransmittingSound.replayAsync();
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play stop transmitting sound',
        context: { error },
      });
    }
  }

  async playConnectedDeviceSound(): Promise<void> {
    try {
      if (this.connectedDeviceSound) {
        await this.connectedDeviceSound.replayAsync();
        logger.debug({ message: 'Sound played successfully', context: { soundName: 'connectedDevice' } });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play connected device sound',
        context: { error },
      });
    }
  }

  async playConnectToAudioRoomSound(): Promise<void> {
    try {
      if (this.connectToAudioRoomSound) {
        await this.connectToAudioRoomSound.replayAsync();
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play connected to audio room sound',
        context: { error },
      });
    }
  }

  async playDisconnectedFromAudioRoomSound(): Promise<void> {
    try {
      if (this.disconnectedFromAudioRoomSound) {
        await this.disconnectedFromAudioRoomSound.replayAsync();
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play disconnected from audio room sound',
        context: { error },
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      const sounds = [this.startTransmittingSound, this.stopTransmittingSound, this.connectedDeviceSound, this.connectToAudioRoomSound, this.disconnectedFromAudioRoomSound];

      await Promise.all(
        sounds.map(async (sound) => {
          if (sound) {
            await sound.unloadAsync();
          }
        })
      );

      this.startTransmittingSound = null;
      this.stopTransmittingSound = null;
      this.connectedDeviceSound = null;
      this.connectToAudioRoomSound = null;
      this.disconnectedFromAudioRoomSound = null;

      this.isInitialized = false;

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
