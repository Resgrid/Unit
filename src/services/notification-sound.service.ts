import { Asset } from 'expo-asset';
import { Audio, type AVPlaybackSource, InterruptionModeIOS } from 'expo-av';

import { logger } from '@/lib/logging';
import type { NotificationType } from '@/stores/push-notification/store';

class NotificationSoundService {
  private static instance: NotificationSoundService;
  private callSound: Audio.Sound | null = null;
  private messageSound: Audio.Sound | null = null;
  private chatSound: Audio.Sound | null = null;
  private groupChatSound: Audio.Sound | null = null;
  private defaultSound: Audio.Sound | null = null;
  private isInitialized = false;

  private constructor() {
    this.initializeAudio();
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
    if (this.isInitialized) {
      return;
    }

    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
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

  private async loadAudioFiles(): Promise<void> {
    try {
      // Load call sound
      const callSoundAsset = Asset.fromModule(require('@assets/audio/newcall.wav'));
      await callSoundAsset.downloadAsync();

      const { sound: callSound } = await Audio.Sound.createAsync({ uri: callSoundAsset.localUri || callSoundAsset.uri } as AVPlaybackSource, {
        shouldPlay: false,
        isLooping: false,
        volume: 1.0,
      });
      this.callSound = callSound;

      // Load message sound
      const messageSoundAsset = Asset.fromModule(require('@assets/audio/newmessage.wav'));
      await messageSoundAsset.downloadAsync();

      const { sound: messageSound } = await Audio.Sound.createAsync({ uri: messageSoundAsset.localUri || messageSoundAsset.uri } as AVPlaybackSource, {
        shouldPlay: false,
        isLooping: false,
        volume: 1.0,
      });
      this.messageSound = messageSound;

      // Load chat sound
      const chatSoundAsset = Asset.fromModule(require('@assets/audio/newchat.wav'));
      await chatSoundAsset.downloadAsync();

      const { sound: chatSound } = await Audio.Sound.createAsync({ uri: chatSoundAsset.localUri || chatSoundAsset.uri } as AVPlaybackSource, {
        shouldPlay: false,
        isLooping: false,
        volume: 1.0,
      });
      this.chatSound = chatSound;

      // Group chat uses the same sound as regular chat
      const { sound: groupChatSound } = await Audio.Sound.createAsync({ uri: chatSoundAsset.localUri || chatSoundAsset.uri } as AVPlaybackSource, {
        shouldPlay: false,
        isLooping: false,
        volume: 1.0,
      });
      this.groupChatSound = groupChatSound;

      // Load default notification sound
      const defaultSoundAsset = Asset.fromModule(require('@assets/audio/notification.wav'));
      await defaultSoundAsset.downloadAsync();

      const { sound: defaultSound } = await Audio.Sound.createAsync({ uri: defaultSoundAsset.localUri || defaultSoundAsset.uri } as AVPlaybackSource, {
        shouldPlay: false,
        isLooping: false,
        volume: 1.0,
      });
      this.defaultSound = defaultSound;

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

  private async playSound(sound: Audio.Sound | null, soundName: string): Promise<void> {
    try {
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
      await sound.setPositionAsync(0);
      await sound.playAsync();

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
      switch (type) {
        case 'call':
          await this.playSound(this.callSound, 'call');
          break;
        case 'message':
          await this.playSound(this.messageSound, 'message');
          break;
        case 'chat':
          await this.playSound(this.chatSound, 'chat');
          break;
        case 'group-chat':
          await this.playSound(this.groupChatSound, 'group-chat');
          break;
        case 'unknown':
        default:
          await this.playSound(this.defaultSound, 'default');
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
        await this.callSound.unloadAsync();
        this.callSound = null;
      }

      if (this.messageSound) {
        await this.messageSound.unloadAsync();
        this.messageSound = null;
      }

      if (this.chatSound) {
        await this.chatSound.unloadAsync();
        this.chatSound = null;
      }

      if (this.groupChatSound) {
        await this.groupChatSound.unloadAsync();
        this.groupChatSound = null;
      }

      if (this.defaultSound) {
        await this.defaultSound.unloadAsync();
        this.defaultSound = null;
      }

      this.isInitialized = false;

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
