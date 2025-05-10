import { Room, RoomEvent } from 'livekit-client';
import { create } from 'zustand';

import { getCanConnectToVoiceSession, getDepartmentVoiceSettings } from '../../api/voice';
import { type DepartmentVoiceChannelResultData } from '../../models/v4/voice/departmentVoiceResultData';

interface LiveKitState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  currentRoom: Room | null;
  currentRoomInfo: DepartmentVoiceChannelResultData | null;
  isTalking: boolean;
  isVoiceEnabled: boolean;
  voipServerWebsocketSslAddress: string;
  callerIdName: string;
  canConnectApiToken: string;
  canConnectToVoiceSession: boolean;
  // Available rooms
  availableRooms: DepartmentVoiceChannelResultData[];

  // UI state
  isBottomSheetVisible: boolean;

  // Actions
  setIsConnected: (isConnected: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setCurrentRoom: (room: Room | null) => void;
  setCurrentRoomInfo: (roomInfo: DepartmentVoiceChannelResultData | null) => void;
  setIsTalking: (isTalking: boolean) => void;
  setAvailableRooms: (rooms: DepartmentVoiceChannelResultData[]) => void;
  setIsBottomSheetVisible: (visible: boolean) => void;

  // Room operations
  connectToRoom: (roomInfo: DepartmentVoiceChannelResultData, token: string) => Promise<void>;
  disconnectFromRoom: () => void;
  fetchVoiceSettings: () => Promise<void>;
  fetchCanConnectToVoice: () => Promise<void>;
}

export const useLiveKitStore = create<LiveKitState>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  currentRoom: null,
  currentRoomInfo: null,
  isTalking: false,
  availableRooms: [],
  isBottomSheetVisible: false,
  isVoiceEnabled: false,
  voipServerWebsocketSslAddress: '',
  callerIdName: '',
  canConnectApiToken: '',
  canConnectToVoiceSession: false,
  setIsConnected: (isConnected) => set({ isConnected }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentRoomInfo: (roomInfo) => set({ currentRoomInfo: roomInfo }),
  setIsTalking: (isTalking) => set({ isTalking }),
  setAvailableRooms: (rooms) => set({ availableRooms: rooms }),
  setIsBottomSheetVisible: (visible) => set({ isBottomSheetVisible: visible }),

  connectToRoom: async (roomInfo, token) => {
    try {
      const { currentRoom, voipServerWebsocketSslAddress } = get();

      // Disconnect from current room if connected
      if (currentRoom) {
        currentRoom.disconnect();
      }

      set({ isConnecting: true });

      // Create a new room
      const room = new Room();

      // Setup room event listeners
      room.on(RoomEvent.ParticipantConnected, () => {
        console.log('A participant connected');
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        console.log('A participant disconnected');
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // Check if local participant is speaking
        const localParticipant = room.localParticipant;
        const isTalking = speakers.some((speaker) => speaker.sid === localParticipant.sid);
        set({ isTalking });
      });

      // Connect to the room
      await room.connect(voipServerWebsocketSslAddress, token);

      // Set microphone to enabled, camera to disabled (audio-only call)
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(false);

      set({
        currentRoom: room,
        currentRoomInfo: roomInfo,
        isConnected: true,
        isConnecting: false,
      });
    } catch (error) {
      console.error('Failed to connect to room:', error);
      set({ isConnecting: false });
    }
  },

  disconnectFromRoom: () => {
    const { currentRoom } = get();
    if (currentRoom) {
      currentRoom.disconnect();
      set({
        currentRoom: null,
        currentRoomInfo: null,
        isConnected: false,
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
      console.error('Failed to fetch rooms:', error);
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
      console.error('Failed to fetch can connect to voice:', error);
    }
  },
}));
