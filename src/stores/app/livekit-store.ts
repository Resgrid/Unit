import { AudioSession } from '@livekit/react-native';
import { RTCAudioSession } from '@livekit/react-native-webrtc';
import notifee, { AndroidForegroundServiceType, AndroidImportance } from '@notifee/react-native';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Audio, InterruptionModeIOS } from 'expo-av';
import * as Device from 'expo-device';
import { Room, RoomEvent } from 'livekit-client';
import { Alert, Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';

import { getCanConnectToVoiceSession, getDepartmentVoiceSettings } from '../../api/voice';
import { logger } from '../../lib/logging';
import { type DepartmentVoiceChannelResultData } from '../../models/v4/voice/departmentVoiceResultData';
import { audioService } from '../../services/audio.service';
import { bluetoothAudioService } from '../../services/bluetooth-audio.service';
import { callKeepService } from '../../services/callkeep.service';
import { useBluetoothAudioStore } from './bluetooth-audio-store';

/** Wrap a promise with a timeout – rejects with a descriptive error if it doesn't settle in time. */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Overall connection timeout – if the entire connectToRoom flow hasn't finished
// within this window, isConnecting is forcibly reset so the UI never gets stuck.
const CONNECT_OVERALL_TIMEOUT_MS = 30_000;

// Helper function to apply audio routing
export const applyAudioRouting = async (deviceType: 'bluetooth' | 'speaker' | 'earpiece' | 'default') => {
  // Audio routing is native-only
  if (Platform.OS === 'web') return;

  try {
    const normalizedDeviceType: 'bluetooth' | 'speaker' | 'earpiece' = deviceType === 'default' ? 'earpiece' : deviceType;

    if (Platform.OS === 'android') {
      logger.info({
        message: 'Applying Android audio routing',
        context: { deviceType: normalizedDeviceType },
      });

      const inCallAudioModule = NativeModules?.InCallAudioModule;

      if (inCallAudioModule?.setAudioRoute) {
        try {
          await inCallAudioModule.setAudioRoute(normalizedDeviceType);
          logger.debug({
            message: 'Applied Android route via InCallAudioModule',
            context: { deviceType: normalizedDeviceType },
          });
        } catch (routeError) {
          logger.warn({
            message: 'Failed to apply Android route via InCallAudioModule, falling back to Audio.setAudioModeAsync',
            context: { deviceType: normalizedDeviceType, error: routeError },
          });
        }
      }

      // On Android, we use RTCAudioSession for precise control
      // First, ensure the audio session is configured correctly
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        // For speaker, we want false (speaker). For others, simple routing.
        playThroughEarpieceAndroid: normalizedDeviceType !== 'speaker',
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      });

      // Use RTCAudioSession to force route selection for WebRTC (Not available on Android in this package)
      // We rely on Audio.setAudioModeAsync and system behavior.
      /*
      const RTCAudioSessionAny = RTCAudioSession as any;
      if (RTCAudioSessionAny.getAudioDevices && RTCAudioSessionAny.selectAudioDevice) {
         // ... (Logic removed as it's iOS only)
      } else {
         logger.info({
            message: 'RTCAudioSession Android methods not available (Relying on system routing)',
         });
      }
      */
      logger.info({
        message: 'Android audio routing applied via Audio.setAudioModeAsync',
        context: { deviceType: normalizedDeviceType },
      });
    } else {
      // iOS handling (Expo AV is usually sufficient, but CallKeep handles the session)
      // Just ensure the mode is correct
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: true,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      });
    }
  } catch (error) {
    logger.error({
      message: 'Failed to apply audio routing',
      context: { error },
    });
  }
};

// Helper function to setup audio routing based on selected devices
const setupAudioRouting = async (room: Room): Promise<void> => {
  try {
    const bluetoothStore = useBluetoothAudioStore.getState();
    const { selectedAudioDevices, connectedDevice } = bluetoothStore;

    // Determine target device type
    let targetType: 'bluetooth' | 'speaker' | 'earpiece' = 'earpiece';

    // If we have a connected Bluetooth device, prioritize it
    if (connectedDevice && connectedDevice.hasAudioCapability) {
      logger.info({
        message: 'Using Bluetooth device for audio routing',
        context: { deviceName: connectedDevice.name },
      });

      // Update selected devices to use Bluetooth
      const deviceName = connectedDevice.name || 'Bluetooth Device';
      const bluetoothMicrophone = connectedDevice.supportsMicrophoneControl ? { id: connectedDevice.id, name: deviceName, type: 'bluetooth' as const, isAvailable: true } : selectedAudioDevices.microphone;

      const bluetoothSpeaker = {
        id: connectedDevice.id,
        name: deviceName,
        type: 'bluetooth' as const,
        isAvailable: true,
      };

      bluetoothStore.setSelectedMicrophone(bluetoothMicrophone);
      bluetoothStore.setSelectedSpeaker(bluetoothSpeaker);

      targetType = 'bluetooth';
    } else {
      // Use default audio devices (selected devices or default)
      logger.debug({
        message: 'Using default audio devices',
        context: { selectedAudioDevices },
      });

      if (selectedAudioDevices.speaker?.type === 'speaker') {
        targetType = 'speaker';
      }
    }

    // Apply the routing
    await applyAudioRouting(targetType);
  } catch (error) {
    logger.error({
      message: 'Failed to setup audio routing',
      context: { error },
    });
  }
};

// Track whether we've already attempted phone-state permissions this session
// so we don't re-fire on every bottom-sheet open / foreground cycle.
let phonePermsAttempted = false;

/**
 * Request Android phone-state permissions (READ_PHONE_STATE / READ_PHONE_NUMBERS)
 * needed by CallKeep.
 *
 * Called once post-connect, right before CallKeep is started.  Results are
 * cached for the lifetime of the app process so subsequent calls are instant
 * no-ops.
 *
 * These permissions are non-critical: CallKeep already gracefully skips when
 * they are missing, so we only log warnings — no user-facing alerts.
 */
const requestAndroidPhonePermissions = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  if (phonePermsAttempted) return;
  phonePermsAttempted = true;

  // Wrap in a 5-second timeout so it can never silently block the Join flow
  // even if a system dialog gets stuck behind a modal.
  const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('requestAndroidPhonePermissions timed out after 5 s')), 5000));

  const work = async (): Promise<void> => {
    logger.debug({ message: '[phonePerms] checking existing grants' });
    const alreadyHasPhoneState = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
    const alreadyHasPhoneNumbers = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
    logger.debug({ message: '[phonePerms] existing grants', context: { alreadyHasPhoneState, alreadyHasPhoneNumbers } });

    if (alreadyHasPhoneState && alreadyHasPhoneNumbers) {
      logger.debug({ message: '[phonePerms] all permissions already granted' });
      return;
    }

    logger.debug({ message: '[phonePerms] checking telephony capability' });
    const hasTelephony = await Device.hasPlatformFeatureAsync('android.hardware.telephony');
    logger.debug({ message: '[phonePerms] hasTelephony', context: { hasTelephony } });

    if (!hasTelephony) {
      logger.info({
        message: 'Device does not have telephony capability - skipping phone state permission request',
      });
      return;
    }

    const permissionsToRequest: string[] = [];
    if (!alreadyHasPhoneState) permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
    if (!alreadyHasPhoneNumbers) permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);

    if (permissionsToRequest.length > 0) {
      logger.debug({ message: '[phonePerms] requesting missing permissions', context: { permissionsToRequest } });
      const phoneResults = await PermissionsAndroid.requestMultiple(permissionsToRequest as Parameters<typeof PermissionsAndroid.requestMultiple>[0]);
      logger.debug({ message: '[phonePerms] requestMultiple returned', context: { phoneResults } });

      const phoneStateResult = alreadyHasPhoneState ? PermissionsAndroid.RESULTS.GRANTED : (phoneResults[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] ?? PermissionsAndroid.RESULTS.DENIED);

      if (phoneStateResult !== PermissionsAndroid.RESULTS.GRANTED) {
        logger.warn({
          message: 'Phone state permission not granted - CallKeep will be skipped but voice calls still work',
          context: { phoneStateResult },
        });
      }
    }
  };

  try {
    await Promise.race([work(), timeoutPromise]);
  } catch (err) {
    logger.warn({
      message: 'Android phone permissions request failed or timed out - CallKeep will be skipped',
      context: { error: err },
    });
  }
};

interface LiveKitState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  currentRoom: Room | null;
  currentRoomInfo: DepartmentVoiceChannelResultData | null;
  isTalking: boolean;
  isMicrophoneEnabled: boolean;
  isVoiceEnabled: boolean;
  voipServerWebsocketSslAddress: string;
  callerIdName: string;
  canConnectApiToken: string;
  canConnectToVoiceSession: boolean;
  // Available rooms
  lastLocalMuteChangeTimestamp: number;
  availableRooms: DepartmentVoiceChannelResultData[];
  isBottomSheetVisible: boolean;

  // Actions
  setIsConnected: (isConnected: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setCurrentRoom: (room: Room | null) => void;
  setCurrentRoomInfo: (roomInfo: DepartmentVoiceChannelResultData | null) => void;
  setIsTalking: (isTalking: boolean) => void;
  setAvailableRooms: (rooms: DepartmentVoiceChannelResultData[]) => void;
  setIsBottomSheetVisible: (visible: boolean) => void;

  // Microphone Control
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  toggleMicrophone: () => Promise<void>;

  // Room operations
  connectToRoom: (roomInfo: DepartmentVoiceChannelResultData, token: string) => Promise<void>;
  disconnectFromRoom: () => void;
  fetchVoiceSettings: () => Promise<void>;
  fetchCanConnectToVoice: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  ensureMicrophonePermission: () => Promise<boolean>;
}

export const useLiveKitStore = create<LiveKitState>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  currentRoom: null,
  currentRoomInfo: null,
  isTalking: false,
  isMicrophoneEnabled: false,
  availableRooms: [],
  isBottomSheetVisible: false,
  isVoiceEnabled: false,
  voipServerWebsocketSslAddress: '',
  callerIdName: '',
  canConnectApiToken: '',
  canConnectToVoiceSession: false,
  lastLocalMuteChangeTimestamp: 0,
  setIsConnected: (isConnected) => set({ isConnected }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentRoomInfo: (roomInfo) => set({ currentRoomInfo: roomInfo }),
  setIsTalking: (isTalking) => set({ isTalking }),
  setAvailableRooms: (rooms) => set({ availableRooms: rooms }),
  setIsBottomSheetVisible: (visible) => set({ isBottomSheetVisible: visible }),

  setMicrophoneEnabled: async (enabled: boolean) => {
    const { currentRoom } = get();
    if (!currentRoom) {
      logger.warn({
        message: 'Cannot set microphone - no active LiveKit room',
        context: { enabled },
      });
      return;
    }

    try {
      const currentMicEnabled = currentRoom.localParticipant.isMicrophoneEnabled;
      // Skip if already in the desired state
      if (enabled && currentMicEnabled) {
        set({ isMicrophoneEnabled: true });
        return;
      }
      if (!enabled && !currentMicEnabled) {
        set({ isMicrophoneEnabled: false });
        return;
      }

      await currentRoom.localParticipant.setMicrophoneEnabled(enabled);

      set({
        isMicrophoneEnabled: enabled,
        lastLocalMuteChangeTimestamp: Date.now(),
      });

      logger.info({
        message: 'Microphone state set via store',
        context: { enabled },
      });

      useBluetoothAudioStore.getState().setLastButtonAction({
        action: enabled ? 'unmute' : 'mute',
        timestamp: Date.now(),
      });

      if (enabled) {
        await audioService.playStartTransmittingSound();
      } else {
        await audioService.playStopTransmittingSound();
      }
    } catch (error) {
      logger.error({
        message: 'Failed to set microphone state',
        context: { error, enabled },
      });
    }
  },

  toggleMicrophone: async () => {
    const { currentRoom } = get();
    if (!currentRoom) {
      logger.warn({
        message: 'Cannot toggle microphone - no active LiveKit room',
      });
      return;
    }

    const currentMuteState = !currentRoom.localParticipant.isMicrophoneEnabled;
    await get().setMicrophoneEnabled(currentMuteState);
  },

  requestPermissions: async (): Promise<boolean> => {
    // Microphone only — phone-state permissions are handled separately by
    // `requestAndroidPhonePermissions`, called post-connect before CallKeep.
    try {
      if (Platform.OS === 'android') {
        // Use PermissionsAndroid directly — expo-audio's
        // requestRecordingPermissionsAsync uses a Fragment-based approach
        // that can silently fail to show the system dialog.
        const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (already) {
          logger.info({
            message: 'Microphone permission already granted',
            context: { platform: Platform.OS },
          });
          return true;
        }

        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          logger.error({
            message: 'Microphone permission not granted',
            context: { platform: Platform.OS, result },
          });
          return false;
        }

        logger.info({
          message: 'Microphone permission granted successfully',
          context: { platform: Platform.OS },
        });
        return true;
      } else if (Platform.OS === 'ios') {
        const micPermission = await getRecordingPermissionsAsync();

        if (!micPermission.granted) {
          const result = await requestRecordingPermissionsAsync();
          if (!result.granted) {
            logger.error({
              message: 'Microphone permission not granted',
              context: { platform: Platform.OS },
            });
            return false;
          }
        }

        logger.info({
          message: 'Microphone permission granted successfully',
          context: { platform: Platform.OS },
        });
        return true;
      }
      return true; // Web/other platforms don't need runtime permissions
    } catch (error) {
      logger.error({
        message: 'Failed to request permissions',
        context: { error, platform: Platform.OS },
      });
      return false;
    }
  },

  connectToRoom: async (roomInfo, token) => {
    logger.info({
      message: 'connectToRoom called',
      context: { roomName: roomInfo.Name, isConnecting: get().isConnecting, isConnected: get().isConnected },
    });
    // Prevent concurrent connection attempts.
    if (get().isConnecting || get().isConnected) {
      logger.warn({
        message: 'Connection already in progress or active, ignoring duplicate request',
        context: { roomName: roomInfo.Name },
      });
      return;
    }

    // Set isConnecting immediately so the UI shows a spinner without waiting
    // for permission checks or any other async work below.
    set({ isConnecting: true });

    // Safety net: if the entire connection flow hasn't finished within the
    // overall timeout, forcibly reset isConnecting so the UI is never
    // permanently stuck on "Connecting…".
    const overallTimeout = setTimeout(() => {
      if (get().isConnecting) {
        logger.error({
          message: 'connectToRoom overall timeout reached – resetting isConnecting',
          context: { roomName: roomInfo.Name, timeoutMs: CONNECT_OVERALL_TIMEOUT_MS },
        });
        set({ isConnecting: false });
        Alert.alert(
          'Voice Connection Timeout',
          `The connection to "${roomInfo.Name}" took too long. Please try again.`,
          [{ text: 'OK' }]
        );
      }
    }, CONNECT_OVERALL_TIMEOUT_MS);

    try {
      const { currentRoom, voipServerWebsocketSslAddress } = get();

      if (!voipServerWebsocketSslAddress) {
        logger.error({
          message: 'Cannot connect to room - no VoIP server address available',
          context: { roomName: roomInfo.Name },
        });
        set({ isConnecting: false });
        Alert.alert('Voice Connection Error', 'Voice server address is not available. Please try again later.');
        return;
      }

      if (!token) {
        logger.error({
          message: 'Cannot connect to room - no token provided',
          context: { roomName: roomInfo.Name },
        });
        set({ isConnecting: false });
        Alert.alert('Voice Connection Error', 'Voice channel token is missing. Please try refreshing the voice channels.');
        return;
      }

      // ─── Verify microphone permission ──────────────────────────────────────
      // Permission should already be granted via ensureMicrophonePermission()
      // called before the bottom sheet opens.  We only verify here.
      logger.debug({
        message: 'connectToRoom: verifying microphone permission',
        context: { roomName: roomInfo.Name },
      });

      const permissionsGranted = await withTimeout(
        get().requestPermissions(),
        10_000,
        'requestPermissions'
      );

      logger.debug({
        message: 'connectToRoom: microphone permission result',
        context: { roomName: roomInfo.Name, permissionsGranted },
      });
      if (!permissionsGranted) {
        logger.error({
          message: 'Cannot connect to room - permissions not granted',
          context: { roomName: roomInfo.Name },
        });
        set({ isConnecting: false });
        Alert.alert('Voice Connection Error', 'Microphone permission is required to join a voice channel. Please grant the permission in your device settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }

      bluetoothAudioService.ensurePttInputMonitoring('livekit-store connectToRoom start');

      // Disconnect from current room if connected
      if (currentRoom) {
        logger.debug({ message: 'connectToRoom: disconnecting existing room' });
        await currentRoom.disconnect();
      }

      // Start the native audio session before connecting (required for production builds)
      // In dev builds, the audio session may persist across hot reloads, but in production
      // cold starts it must be explicitly started for WebRTC to function correctly
      if (Platform.OS !== 'web') {
        try {
          logger.debug({ message: 'connectToRoom: starting audio session' });
          await withTimeout(
            AudioSession.startAudioSession(),
            10_000,
            'AudioSession.startAudioSession'
          );
          logger.info({
            message: 'Audio session started successfully',
          });
        } catch (audioSessionError) {
          logger.warn({
            message: 'Failed to start audio session - continuing with connection attempt',
            context: { error: audioSessionError },
          });
        }
      }

      // Create a new room
      const room = new Room();

      // Setup room event listeners
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        logger.info({
          message: 'A participant connected',
          context: { participantIdentity: participant.identity },
        });
        // Play connection sound when others join
        if (participant.identity !== room.localParticipant.identity) {
          //audioService.playConnectToAudioRoomSound();
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        logger.info({
          message: 'A participant disconnected',
          context: { participantIdentity: participant.identity },
        });
        // Play disconnection sound when others leave
        //audioService.playDisconnectedFromAudioRoomSound();
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // Check if local participant is speaking
        const localParticipant = room.localParticipant;
        const isTalking = speakers.some((speaker) => speaker.sid === localParticipant.sid);
        set({ isTalking });
      });

      // Connect to the room
      logger.info({
        message: 'Connecting to LiveKit room',
        context: {
          roomName: roomInfo.Name,
          hasServerUrl: !!voipServerWebsocketSslAddress,
          serverUrlPrefix: voipServerWebsocketSslAddress.substring(0, 10),
          hasToken: !!token,
        },
      });
      await withTimeout(
        room.connect(voipServerWebsocketSslAddress, token),
        15_000,
        'room.connect'
      );
      logger.info({
        message: 'LiveKit room connected successfully',
        context: { roomName: roomInfo.Name },
      });

      // Commit room state to the store immediately after a successful connect so
      // subsequent steps (setMicrophoneEnabled, setCameraEnabled, etc.) can't orphan
      // a live room if they throw.
      set({
        currentRoom: room,
        currentRoomInfo: roomInfo,
        isConnected: true,
        isConnecting: false,
        isMicrophoneEnabled: false,
        lastLocalMuteChangeTimestamp: Date.now(),
      });

      // Set microphone to muted by default, camera to disabled (audio-only call)
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
        await room.localParticipant.setCameraEnabled(false);
      } catch (trackError) {
        logger.warn({
          message: 'Failed to set initial microphone/camera state - room is still connected',
          context: { error: trackError },
        });
      }

      // Setup CallKeep mute sync
      callKeepService.setMuteStateCallback(async (muted) => {
        logger.info({
          message: 'Syncing mute state from CallKeep',
          context: { muted },
        });

        if (room.localParticipant.isMicrophoneEnabled === muted) {
          // If CallKeep says "muted" (true), and Mic is enabled (true), we need to disable mic.
          // If CallKeep says "unmuted" (false), and Mic is disabled (false), we need to enable mic.
          // Wait, logic check:
          // isMicrophoneEnabled = true means NOT MUTED.
          // muted = true means MUTED.
          // So if isMicrophoneEnabled (true) and muted (true) -> mismatch, we must mute.
          // if isMicrophoneEnabled (false) and muted (false) -> mismatch, we must unmute.

          // Actually effectively: setMicrophoneEnabled(!muted)
          const nextMicEnabled = !muted;
          await room.localParticipant.setMicrophoneEnabled(nextMicEnabled);

          set({
            isMicrophoneEnabled: nextMicEnabled,
            lastLocalMuteChangeTimestamp: Date.now(),
          });

          // Play sound
          if (!muted) {
            await audioService.playStartTransmittingSound();
          } else {
            await audioService.playStopTransmittingSound();
          }
        }
      });

      // Setup CallKeep End Call sync
      callKeepService.setEndCallCallback(() => {
        logger.info({
          message: 'CallKeep end call event received, disconnecting room',
        });
        get().disconnectFromRoom();
      });

      // Also ensure reverse sync: When app mutes, tell CallKeep?
      // CallKeep tracks its own state, usually triggered by UI or simple interactions.
      // If we mute from within the app (e.g. on screen button), we might want to tell CallKeep we are muted.
      // However, react-native-callkeep doesn't easily expose "setMuted" for the system call without ending logic or being complex?
      // Actually RNCallKeep.setMutedCall(uuid, muted) exists.

      const onLocalTrackMuted = () => {
        // Update CallKeep state if needed?
        // For now, let's just trust CallKeep's own state management or system UI.
      };

      // We attach these listeners to the local participant if needed for other UI sync

      // Setup audio routing based on selected devices
      // This may change audio modes/focus, so it comes after media button init
      await setupAudioRouting(room);

      await audioService.playConnectToAudioRoomSound();

      // Android foreground service for background audio.
      // Only needed on Android - iOS uses CallKeep, web browsers handle audio natively.
      // NOTE: notifee.registerForegroundService() is called once at app startup
      // (app-initialization.service.ts). Here we only display the notification
      // that triggers the already-registered handler.
      if (Platform.OS === 'android') {
        try {
          await notifee.displayNotification({
            title: 'Active PTT Call',
            body: 'There is an active PTT call in progress.',
            android: {
              channelId: 'notif',
              asForegroundService: true,
              foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE],
              smallIcon: 'ic_launcher',
            },
          });
          logger.info({
            message: 'Android foreground service notification displayed',
          });
        } catch (error) {
          logger.error({
            message: 'Failed to display foreground service notification',
            context: { error },
          });
          // Don't fail the connection if the foreground service display fails.
          // The call will still work but may be killed when backgrounded.
        }
      }

      // Start CallKeep call for background audio support
      // On web, callKeepService provides no-op implementation but still tracks call state
      try {
        // On Android, CallKeep's VoiceConnectionService requires READ_PHONE_NUMBERS
        // permission. Request them here (post-connect) so they never race with
        // the microphone permission dialog.  If not granted, skip CallKeep.
        let shouldStartCallKeep = true;
        if (Platform.OS === 'android') {
          await requestAndroidPhonePermissions();
          const hasPhoneNumbers = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
          const hasPhoneState = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
          if (!hasPhoneNumbers || !hasPhoneState) {
            shouldStartCallKeep = false;
            logger.warn({
              message: 'Skipping CallKeep - phone permissions not granted (READ_PHONE_NUMBERS or READ_PHONE_STATE)',
              context: { hasPhoneNumbers, hasPhoneState },
            });
          }
        }

        if (shouldStartCallKeep) {
          const callUUID = await callKeepService.startCall(roomInfo.Name || 'Voice Channel');
          logger.info({
            message: 'CallKeep call started for background audio support',
            context: { callUUID, roomName: roomInfo.Name, platform: Platform.OS },
          });
        }
      } catch (callKeepError) {
        logger.warn({
          message: 'Failed to start CallKeep call - background audio may not work',
          context: { error: callKeepError },
        });
        // Don't fail the connection if CallKeep fails
      }

      bluetoothAudioService.ensurePttInputMonitoring('livekit-store connectToRoom connected');
    } catch (error) {
      logger.error({
        message: 'Failed to connect to room',
        context: { error, roomName: roomInfo?.Name },
      });

      // Stop audio session on failure since we started it above
      if (Platform.OS !== 'web') {
        try {
          await AudioSession.stopAudioSession();
        } catch (stopError) {
          logger.warn({
            message: 'Failed to stop audio session after connection error',
            context: { error: stopError },
          });
        }
      }

      set({ isConnecting: false });

      // Show user-visible error so the failure is not silent in production builds
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      Alert.alert('Voice Connection Failed', `Unable to connect to voice channel "${roomInfo?.Name || 'Unknown'}". ${errorMessage}`, [{ text: 'OK' }]);
    } finally {
      clearTimeout(overallTimeout);
    }
  },

  disconnectFromRoom: async () => {
    const { currentRoom } = get();
    if (currentRoom) {
      await currentRoom.disconnect();
      await audioService.playDisconnectedFromAudioRoomSound();

      // Stop the native audio session that was started during connectToRoom
      if (Platform.OS !== 'web') {
        try {
          await AudioSession.stopAudioSession();
          logger.debug({
            message: 'Audio session stopped',
          });
        } catch (audioSessionError) {
          logger.warn({
            message: 'Failed to stop audio session',
            context: { error: audioSessionError },
          });
        }
      }

      // End CallKeep call (works on all platforms - web has no-op implementation)
      try {
        await callKeepService.endCall();
        logger.debug({
          message: 'CallKeep call ended',
        });
      } catch (callKeepError) {
        logger.warn({
          message: 'Failed to end CallKeep call',
          context: { error: callKeepError },
        });
      }

      // Stop Android foreground service
      if (Platform.OS === 'android') {
        try {
          await notifee.stopForegroundService();
        } catch (error) {
          logger.error({
            message: 'Failed to stop foreground service',
            context: { error },
          });
        }
      }

      // Cleanup CallKeep Mute Callback
      callKeepService.setMuteStateCallback(null);
      callKeepService.setEndCallCallback(null);

      set({
        currentRoom: null,
        currentRoomInfo: null,
        isConnected: false,
        isMicrophoneEnabled: false,
        isTalking: false,
      });
    }
  },

  fetchVoiceSettings: async () => {
    try {
      const response = await getDepartmentVoiceSettings();

      let rooms: DepartmentVoiceChannelResultData[] = [];
      if (response.Data.VoiceEnabled && response.Data?.Channels) {
        //rooms.push({
        //  id: '0',
        //  name: 'No Channel Selected',
        //});

        rooms.push(...response.Data.Channels);
      } //else {
      //  rooms.push({
      //    id: '0',
      //    name: 'No Channel Selected',
      //  });
      //}

      set({
        isVoiceEnabled: response.Data.VoiceEnabled,
        voipServerWebsocketSslAddress: response.Data.VoipServerWebsocketSslAddress,
        callerIdName: response.Data.CallerIdName,
        canConnectApiToken: response.Data.CanConnectApiToken,
        availableRooms: rooms,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to fetch rooms',
        context: { error },
      });
    }
  },

  fetchCanConnectToVoice: async () => {
    try {
      const { canConnectApiToken } = get();
      const response = await getCanConnectToVoiceSession(canConnectApiToken);

      if (response && response.Data && response.Data.CanConnect) {
        set({
          canConnectToVoiceSession: response.Data.CanConnect,
        });
      } else {
        set({ canConnectToVoiceSession: false });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to fetch can connect to voice',
        context: { error },
      });
    }
  },

  ensureMicrophonePermission: async (): Promise<boolean> => {
    // Request microphone permission BEFORE the Actionsheet (Modal) opens.
    // On Android the system permission dialog is a Dialog attached to the
    // Activity window.  Gluestack's Actionsheet uses a React Native Modal
    // that creates a separate window above the Activity, hiding the
    // permission dialog.  By requesting here (no Modal on screen), the
    // dialog is always visible to the user.
    try {
      if (Platform.OS === 'android') {
        const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (already) return true;

        logger.info({
          message: 'Requesting microphone permission before opening voice UI',
          context: { platform: Platform.OS },
        });
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          logger.warn({
            message: 'Microphone permission denied - voice UI will still open but joining will fail',
            context: { platform: Platform.OS, result },
          });
          return false;
        }
        return true;
      } else if (Platform.OS === 'ios') {
        const mic = await getRecordingPermissionsAsync();
        if (mic.granted) return true;

        logger.info({
          message: 'Requesting microphone permission before opening voice UI',
          context: { platform: Platform.OS },
        });
        const result = await requestRecordingPermissionsAsync();
        if (!result.granted) {
          logger.warn({
            message: 'Microphone permission denied - voice UI will still open but joining will fail',
            context: { platform: Platform.OS },
          });
          return false;
        }
        return true;
      }
      return true;
    } catch (error) {
      logger.error({
        message: 'Failed to request microphone permission',
        context: { error, platform: Platform.OS },
      });
      return false;
    }
  },
}));
