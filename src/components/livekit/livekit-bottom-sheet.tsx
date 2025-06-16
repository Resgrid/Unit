import { t } from 'i18next';
import { Mic, MicOff, PhoneOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { type DepartmentVoiceChannelResultData } from '@/models/v4/voice/departmentVoiceResultData';

import { Card } from '../../components/ui/card';
import { Text } from '../../components/ui/text';
import { useLiveKitStore } from '../../stores/app/livekit-store';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { HStack } from '../ui/hstack';

export enum BottomSheetView {
  ROOM_SELECT = 'room_select',
  CONNECTED = 'connected',
}

export const LiveKitBottomSheet = () => {
  const { isBottomSheetVisible, setIsBottomSheetVisible, availableRooms, fetchVoiceSettings, connectToRoom, disconnectFromRoom, currentRoomInfo, isConnected, isConnecting, isTalking } = useLiveKitStore();
  const { colorScheme } = useColorScheme();

  const [currentView, setCurrentView] = useState<BottomSheetView>(BottomSheetView.ROOM_SELECT);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // If we're showing the sheet, make sure we have the latest rooms
    if (isBottomSheetVisible && currentView === BottomSheetView.ROOM_SELECT) {
      fetchVoiceSettings();
    }
  }, [isBottomSheetVisible, currentView, fetchVoiceSettings]);

  useEffect(() => {
    // If we're connected to a room, show the connected view
    if (isConnected && currentRoomInfo) {
      setCurrentView(BottomSheetView.CONNECTED);
    } else {
      setCurrentView(BottomSheetView.ROOM_SELECT);
    }
  }, [isConnected, currentRoomInfo]);

  const handleRoomSelect = (room: DepartmentVoiceChannelResultData) => {
    connectToRoom(room, room.Token);
  };

  const handleMuteToggle = async () => {
    const { currentRoom } = useLiveKitStore.getState();
    if (currentRoom) {
      const newMuteState = !isMuted;
      await currentRoom.localParticipant.setMicrophoneEnabled(!newMuteState);
      setIsMuted(newMuteState);
    }
  };

  const handleDisconnect = () => {
    disconnectFromRoom();
    setCurrentView(BottomSheetView.ROOM_SELECT);
  };

  const renderRoomSelect = () => (
    <View style={styles.content}>
      {availableRooms.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-center text-lg font-medium text-gray-500">{t('livekit.no_rooms_available')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.roomList}>
          {availableRooms.map((room) => (
            <Card key={room.Id} className="mb-2 w-full flex-row items-center justify-between p-4">
              <Text className="font-medium">{room.Name}</Text>
              <TouchableOpacity onPress={() => handleRoomSelect(room)} style={styles.joinButton}>
                <Text style={styles.joinButtonText}>{t('livekit.join')}</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderConnectedView = () => (
    <View style={styles.content}>
      <Text className="mb-2 text-lg font-bold">{t('livekit.connected_to_room')}</Text>
      <Card className="mb-4 w-full p-4">
        <Text className="text-center text-lg font-medium">{currentRoomInfo?.Name}</Text>
        {isTalking && <Text className="text-center text-green-500">{t('livekit.speaking')}</Text>}
      </Card>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleMuteToggle}>
          {isMuted ? <MicOff size={24} color="#FF3B30" /> : <Mic size={24} color="#007AFF" />}
          <Text className="mt-1">{isMuted ? t('livekit.unmute') : t('livekit.mute')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={handleDisconnect}>
          <PhoneOff size={24} color="#FF3B30" />
          <Text className="mt-1">{t('livekit.disconnect')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Actionsheet isOpen={isBottomSheetVisible} onClose={() => setIsBottomSheetVisible(false)} snapPoints={[40]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="rounded-t-3x bg-white dark:bg-gray-800">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <View className="w-full p-4">
          <HStack className="mb-4 items-center justify-between">
            <Text className="text-xl font-bold">{t('livekit.title')}</Text>
          </HStack>

          <View className="min-h-[300px]">
            {isConnecting ? (
              <View style={styles.content}>
                <Text className="text-center text-lg font-medium">{t('livekit.connecting')}</Text>
              </View>
            ) : currentView === BottomSheetView.ROOM_SELECT ? (
              renderRoomSelect()
            ) : (
              renderConnectedView()
            )}
          </View>
        </View>
      </ActionsheetContent>
    </Actionsheet>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
  },
  roomList: {
    flex: 1,
  },
  roomItem: {
    marginBottom: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  joinButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
