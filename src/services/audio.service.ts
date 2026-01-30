import { Asset } from 'expo-asset';
import { Audio, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

import { logger } from '@/lib/logging';

class AudioService {
  private static instance: AudioService;

  // Expo AV Sound objects
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      });

      // Initialize Native In-Call Audio Module on Android
      if (Platform.OS === 'android') {
        const { InCallAudioModule } = require('react-native').NativeModules;
        if (InCallAudioModule) {
          // Load sounds into native SoundPool
          // Map functional names to resource names (without extension)
          InCallAudioModule.loadSound('startTransmitting', 'software_interface_start');
          InCallAudioModule.loadSound('stopTransmitting', 'software_interface_back');
          InCallAudioModule.loadSound('connectedDevice', 'positive_interface_beep');
          InCallAudioModule.loadSound('connectToAudioRoom', 'space_notification1');
          InCallAudioModule.loadSound('disconnectedFromAudioRoom', 'space_notification2');
        }
      }

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

  private async loadSound(module: any): Promise<Audio.Sound | null> {
    try {
      const { sound } = await Audio.Sound.createAsync(module);
      return sound;
    } catch (error) {
      logger.error({
        message: 'Error loading sound',
        context: { error },
      });
      return null;
    }
  }

  private async loadAudioFiles(): Promise<void> {
    try {
      const [startTransmittingSound, stopTransmittingSound, connectedDeviceSound, connectToAudioRoomSound, disconnectedFromAudioRoomSound] = await Promise.all([
        this.loadSound(require('@assets/audio/ui/space_notification1.mp3')),
        this.loadSound(require('@assets/audio/ui/space_notification2.mp3')),
        this.loadSound(require('@assets/audio/ui/positive_interface_beep.mp3')),
        this.loadSound(require('@assets/audio/ui/software_interface_start.mp3')),
        this.loadSound(require('@assets/audio/ui/software_interface_back.mp3')),
      ]);

      this.startTransmittingSound = startTransmittingSound;
      this.stopTransmittingSound = stopTransmittingSound;
      this.connectedDeviceSound = connectedDeviceSound;
      this.connectToAudioRoomSound = connectToAudioRoomSound;
      this.disconnectedFromAudioRoomSound = disconnectedFromAudioRoomSound;

      this.isInitialized = true;

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

  private async playSound(sound: Audio.Sound | null, name: string): Promise<void> {
    if (Platform.OS === 'android') {
      const { InCallAudioModule } = require('react-native').NativeModules;
      if (InCallAudioModule) {
        InCallAudioModule.playSound(name);
        logger.debug({ message: 'Played sound via Native Module', context: { soundName: name } });
        return;
      }
    }

    if (!sound) return;
    try {
      await sound.replayAsync();
      logger.debug({ message: 'Sound played successfully', context: { soundName: name } });
    } catch (error) {
      logger.warn({
        message: `Failed to play ${name} sound`,
        context: { error },
      });
    }
  }

  async playStartTransmittingSound(): Promise<void> {
    await this.playSound(this.startTransmittingSound, 'startTransmitting');
  }

  async playStopTransmittingSound(): Promise<void> {
    await this.playSound(this.stopTransmittingSound, 'stopTransmitting');
  }

  async playConnectedDeviceSound(): Promise<void> {
    await this.playSound(this.connectedDeviceSound, 'connectedDevice');
  }

  async playConnectToAudioRoomSound(): Promise<void> {
    await this.playSound(this.connectToAudioRoomSound, 'connectToAudioRoom');
  }

  async playDisconnectedFromAudioRoomSound(): Promise<void> {
    await this.playSound(this.disconnectedFromAudioRoomSound, 'disconnectedFromAudioRoom');
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
