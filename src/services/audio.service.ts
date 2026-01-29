import { Asset } from 'expo-asset';
import { Audio, type AVPlaybackSource, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';
import Sound from 'react-native-sound';

import { logger } from '@/lib/logging';

// Enable playback in silence mode
Sound.setCategory('Ambient', true);

class AudioService {
  private static instance: AudioService;
  // Use specific type for react-native-sound instances
  private startTransmittingSound: Sound | null = null;
  private stopTransmittingSound: Sound | null = null;
  
  // Keep others as expo-av for now
  private connectedDeviceSound: Sound | null = null;
  private connectToAudioRoomSound: Sound | null = null;
  private disconnectedFromAudioRoomSound: Sound | null = null;
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
      // Note: react-native-sound handles its own session category (Ambient), 
      // ensuring expo-av doesn't conflict is still good practice if used elsewhere.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        // For speaker, we want false (speaker). For others, simple routing.
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
      // Load start transmitting sound (react-native-sound)
      const startTransmittingSoundAsset = Asset.fromModule(require('@assets/audio/ui/space_notification1.mp3'));
      await startTransmittingSoundAsset.downloadAsync();
      const startUri = startTransmittingSoundAsset.localUri || startTransmittingSoundAsset.uri;
      
      this.startTransmittingSound = new Sound(startUri, '', (error) => {
        if (error) {
          logger.error({ message: 'Failed to load start transmitting sound', context: { error } });
        }
      });

      // Load stop transmitting sound (react-native-sound)
      const stopTransmittingSoundAsset = Asset.fromModule(require('@assets/audio/ui/space_notification2.mp3'));
      await stopTransmittingSoundAsset.downloadAsync();
      const stopUri = stopTransmittingSoundAsset.localUri || stopTransmittingSoundAsset.uri;

      this.stopTransmittingSound = new Sound(stopUri, '', (error) => {
        if (error) {
          logger.error({ message: 'Failed to load stop transmitting sound', context: { error } });
        }
      });

      // Load connected device sound (react-native-sound)
      const connectedDeviceSoundAsset = Asset.fromModule(require('@assets/audio/ui/positive_interface_beep.mp3'));
      await connectedDeviceSoundAsset.downloadAsync();
      const connectedUri = connectedDeviceSoundAsset.localUri || connectedDeviceSoundAsset.uri;

      this.connectedDeviceSound = new Sound(connectedUri, '', (error) => {
        if (error) {
            logger.error({ message: 'Failed to load connected device sound', context: { error } });
        }
      });

      // Load connect to audio room sound (react-native-sound)
      const connectToAudioRoomSoundAsset = Asset.fromModule(require('@assets/audio/ui/software_interface_start.mp3'));
      await connectToAudioRoomSoundAsset.downloadAsync();
      const connectRoomUri = connectToAudioRoomSoundAsset.localUri || connectToAudioRoomSoundAsset.uri;

      this.connectToAudioRoomSound = new Sound(connectRoomUri, '', (error) => {
        if (error) {
            logger.error({ message: 'Failed to load connect to audio room sound', context: { error } });
        }
      });

      // Load disconnect from audio room sound (react-native-sound)
      const disconnectedFromAudioRoomSoundAsset = Asset.fromModule(require('@assets/audio/ui/software_interface_back.mp3'));
      await disconnectedFromAudioRoomSoundAsset.downloadAsync();
      const disconnectRoomUri = disconnectedFromAudioRoomSoundAsset.localUri || disconnectedFromAudioRoomSoundAsset.uri;

      this.disconnectedFromAudioRoomSound = new Sound(disconnectRoomUri, '', (error) => {
        if (error) {
            logger.error({ message: 'Failed to load disconnect from audio room sound', context: { error } });
        }
      });

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

  // Remove old playSound helper as we are using Sound directly now
  // private async playSound... 

  // Updated to use react-native-sound
  async playStartTransmittingSound(): Promise<void> {
    try {
      if (this.startTransmittingSound) {
        // Stop if playing
        this.startTransmittingSound.stop();
        // Play
        this.startTransmittingSound.play((success) => {
            if (!success) {
                logger.warn({ message: 'Failed to play start transmitting sound (playback error)' });
            }
        });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play start transmitting sound',
        context: { error },
      });
    }
  }

  // Updated to use react-native-sound
  async playStopTransmittingSound(): Promise<void> {
    try {
        if (this.stopTransmittingSound) {
            // Stop if playing
            this.stopTransmittingSound.stop();
            // Play
            this.stopTransmittingSound.play((success) => {
                if (!success) {
                    logger.warn({ message: 'Failed to play stop transmitting sound (playback error)' });
                }
            });
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
        this.connectedDeviceSound.stop();
        this.connectedDeviceSound.play((success) => {
            if (success) {
                logger.debug({ message: 'Sound played successfully', context: { soundName: 'connectedDevice' } });
            } else {
                logger.warn({ message: 'Failed to play connected device sound (playback error)' });
            }
        });
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
            this.connectToAudioRoomSound.stop();
            this.connectToAudioRoomSound.play((success) => {
                if (!success) {
                    logger.warn({ message: 'Failed to play connect to audio room sound' });
                }
            });
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
            this.disconnectedFromAudioRoomSound.stop();
            this.disconnectedFromAudioRoomSound.play((success) => {
                if (!success) {
                    logger.warn({ message: 'Failed to play disconnected from audio room sound' });
                }
            });
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
      // Unload start transmitting sound
      if (this.startTransmittingSound) {
        this.startTransmittingSound.release();
        this.startTransmittingSound = null;
      }

      // Unload stop transmitting sound
      if (this.stopTransmittingSound) {
        this.stopTransmittingSound.release();
        this.stopTransmittingSound = null;
      }

      // Unload connected device sound
      if (this.connectedDeviceSound) {
        this.connectedDeviceSound.release();
        this.connectedDeviceSound = null;
      }

      // Unload connect to audio room sound
      if (this.connectToAudioRoomSound) {
        this.connectToAudioRoomSound.release();
        this.connectToAudioRoomSound = null;
      }

      // Unload disconnect from audio room sound
      if (this.disconnectedFromAudioRoomSound) {
        this.disconnectedFromAudioRoomSound.release();
        this.disconnectedFromAudioRoomSound = null;
      }

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
