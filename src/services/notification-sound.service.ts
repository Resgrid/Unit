import { Asset } from 'expo-asset';
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { logger } from '@/lib/logging';
import type { NotificationType } from '@/stores/push-notification/store';

class NotificationSoundService {
  private static instance: NotificationSoundService;
  private callSound: AudioPlayer | null = null;
  private messageSound: AudioPlayer | null = null;
  private chatSound: AudioPlayer | null = null;
  private groupChatSound: AudioPlayer | null = null;
  private defaultSound: AudioPlayer | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Initialization will happen lazily on first use
  }

  static getInstance(): NotificationSoundService {
    if (!NotificationSoundService.instance) {
      NotificationSoundService.instance = new NotificationSoundService();
    }
    return NotificationSoundService.instance;
  }

  public async initialize(): Promise<void> {
    await this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized) {
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization and store the promise
    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    // Notification sounds are native-only; skip on web
    if (Platform.OS === 'web') {
      this.isInitialized = true;
      return;
    }

    try {
      // Configure audio mode
      await setAudioModeAsync({
        allowsRecording: false,
        shouldPlayInBackground: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });

      // Pre-load audio assets
      await this.preloadAudioAssets();

      // Load audio files
      await this.loadAudioFiles();

      this.isInitialized = true;

      logger.info({
        message: 'Notification sound service initialized successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize notification sound service',
        context: { error },
      });
      // Reset initialization promise on failure so it can be retried
      this.initializationPromise = null;
    }
  }

  private async preloadAudioAssets(): Promise<void> {
    try {
      await Promise.all([
        Asset.loadAsync(require('@assets/audio/newcall.wav')),
        Asset.loadAsync(require('@assets/audio/newmessage.wav')),
        Asset.loadAsync(require('@assets/audio/newchat.wav')),
        Asset.loadAsync(require('@assets/audio/notification.wav')),
      ]);

      logger.debug({
        message: 'Notification audio assets preloaded successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Error preloading notification audio assets',
        context: { error },
      });
    }
  }

  /**
   * Helper method to load a sound asset from a require path
   * @param assetRequire - The required asset module
   * @param soundName - Name of the sound for logging purposes
   * @returns The created AudioPlayer or null on failure
   */
  private async loadSound(assetRequire: number, soundName: string): Promise<AudioPlayer | null> {
    try {
      const asset = Asset.fromModule(assetRequire);
      await asset.downloadAsync();

      const player = createAudioPlayer({ uri: asset.localUri || asset.uri }, { keepAudioSessionActive: true });
      player.loop = false;
      player.volume = 1.0;
      return player;
    } catch (error) {
      logger.error({
        message: `Failed to load sound: ${soundName}`,
        context: { error },
      });
      return null;
    }
  }

  private async loadAudioFiles(): Promise<void> {
    try {
      // Load call sound
      this.callSound = await this.loadSound(require('@assets/audio/newcall.wav'), 'call');

      // Load message sound
      this.messageSound = await this.loadSound(require('@assets/audio/newmessage.wav'), 'message');

      // Load chat sound
      const chatSoundAsset = Asset.fromModule(require('@assets/audio/newchat.wav'));
      await chatSoundAsset.downloadAsync();

      this.chatSound = await this.loadSound(require('@assets/audio/newchat.wav'), 'chat');

      // Group chat uses the same sound as regular chat
      const groupChatSound = createAudioPlayer({ uri: chatSoundAsset.localUri || chatSoundAsset.uri }, { keepAudioSessionActive: true });
      groupChatSound.loop = false;
      groupChatSound.volume = 1.0;
      this.groupChatSound = groupChatSound;

      // Load default notification sound
      this.defaultSound = await this.loadSound(require('@assets/audio/notification.wav'), 'default');

      logger.debug({
        message: 'Notification audio files loaded successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to load notification audio files',
        context: { error },
      });
    }
  }

  private async playSound(sound: AudioPlayer | null, soundName: string): Promise<void> {
    try {
      // Notification sounds are native-only; return silently on web
      if (Platform.OS === 'web') {
        return;
      }

      if (!sound) {
        logger.warn({
          message: `Notification sound not loaded: ${soundName}`,
        });
        return;
      }

      // Ensure audio service is initialized
      if (!this.isInitialized) {
        await this.initializeAudio();
      }

      // Reset to start and play
      if (sound.isLoaded) {
        await sound.seekTo(0);
      }
      sound.play();

      logger.debug({
        message: 'Notification sound played successfully',
        context: { soundName },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play notification sound',
        context: { soundName, error },
      });
    }
  }

  public async playNotificationSound(type: NotificationType): Promise<void> {
    try {
      // Ensure audio is initialized before accessing sound properties
      await this.initializeAudio();

      // Capture sound properties into local variables after initialization
      const callSound = this.callSound;
      const messageSound = this.messageSound;
      const chatSound = this.chatSound;
      const groupChatSound = this.groupChatSound;
      const defaultSound = this.defaultSound;

      switch (type) {
        case 'call':
          await this.playSound(callSound, 'call');
          break;
        case 'message':
          await this.playSound(messageSound, 'message');
          break;
        case 'chat':
          await this.playSound(chatSound, 'chat');
          break;
        case 'group-chat':
          await this.playSound(groupChatSound, 'group-chat');
          break;
        case 'unknown':
        default:
          await this.playSound(defaultSound, 'default');
          break;
      }
    } catch (error) {
      logger.error({
        message: 'Failed to play notification sound for type',
        context: { type, error },
      });
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Unload all sounds
      if (this.callSound) {
        this.callSound.remove();
        this.callSound = null;
      }

      if (this.messageSound) {
        this.messageSound.remove();
        this.messageSound = null;
      }

      if (this.chatSound) {
        this.chatSound.remove();
        this.chatSound = null;
      }

      if (this.groupChatSound) {
        this.groupChatSound.remove();
        this.groupChatSound = null;
      }

      if (this.defaultSound) {
        this.defaultSound.remove();
        this.defaultSound = null;
      }

      this.isInitialized = false;
      this.initializationPromise = null;

      logger.info({
        message: 'Notification sound service cleaned up',
      });
    } catch (error) {
      logger.error({
        message: 'Error during notification sound service cleanup',
        context: { error },
      });
    }
  }
}

export const notificationSoundService = NotificationSoundService.getInstance();
