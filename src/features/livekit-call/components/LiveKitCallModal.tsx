import { AlertTriangle, CheckCircle, CircleIcon, Mic, MicOff, PhoneMissed } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { type RoomInfo, useLiveKitCallStore } from '../store/useLiveKitCallStore';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicatorWrapper, ActionsheetDragIndicator } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Radio, RadioGroup, RadioIndicator, RadioLabel } from '@/components/ui/radio';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface LiveKitCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantIdentity?: string; // Optional: pass if you have a specific identity
}

const LiveKitCallModal: React.FC<LiveKitCallModalProps> = ({
  isOpen,
  onClose,
  participantIdentity = `user-${Math.random().toString(36).substring(7)}`, // Default unique enough for example
}) => {
  const { availableRooms, selectedRoomForJoining, currentRoomId, isConnecting, isConnected, error, localParticipant, actions } = useLiveKitCallStore();

  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  useEffect(() => {
    if (localParticipant) {
      const micPublication = localParticipant.getTrackPublicationByName('microphone');
      setIsMicrophoneEnabled(micPublication ? micPublication.isMuted === false : true);
    } else {
      setIsMicrophoneEnabled(true); // Default before connected
    }
  }, [localParticipant, isConnected]);

  const handleJoinRoom = () => {
    if (selectedRoomForJoining && !isConnecting && !isConnected) {
      actions.connectToRoom(selectedRoomForJoining, participantIdentity);
      // Modal can be closed by user, connection persists via store
    }
  };

  const handleLeaveRoom = () => {
    actions.disconnectFromRoom();
    onClose(); // Close modal on leaving
  };

  const handleToggleMicrophone = async () => {
    await actions.setMicrophoneEnabled(!isMicrophoneEnabled);
    setIsMicrophoneEnabled(!isMicrophoneEnabled); // Update local state immediately for UI responsiveness
  };

  const internalOnClose = () => {
    if (isConnecting) {
      // Optionally prevent closing or ask for confirmation if connecting
      // For now, allow close
    }
    actions._clearError(); // Clear any transient errors when modal is closed
    onClose();
  };

  const currentRoomName = availableRooms.find((r) => r.id === currentRoomId)?.name || currentRoomId;
  const selectedRoomName = availableRooms.find((r) => r.id === selectedRoomForJoining)?.name || selectedRoomForJoining;

  return (
    <Actionsheet isOpen={isOpen} onClose={internalOnClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[40%] px-4 py-2">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {isConnecting ? (
          <VStack space="md" className="items-center justify-center flex-1 min-h-[150px]">
            <Spinner size="large" />
            <Text>Connecting to {selectedRoomName || 'room'}...</Text>
          </VStack>
        ) : error ? (
          <VStack space="md" className="items-center justify-center flex-1 p-4 min-h-[150px]">
            <AlertTriangle size={48} color="red" />
            <Heading size="md" className="text-red-700">
              Connection Error
            </Heading>
            <Text className="text-center">{error}</Text>
            <Button
              onPress={() => {
                actions._clearError();
                if (!isConnected) actions.setSelectedRoomForJoining(null);
              }}
              className="mt-4"
            >
              <ButtonText>Try Again</ButtonText>
            </Button>
          </VStack>
        ) : isConnected && currentRoomId ? (
          <VStack space="lg" className="py-4 flex-1 justify-between">
            <Box>
              <HStack className="items-center mb-2" space="sm">
                <CheckCircle color="green" size={24} />
                <Heading size="lg">Connected</Heading>
              </HStack>
              <Text>
                You are in room: <Text className="font-bold">{currentRoomName}</Text>
              </Text>
              {localParticipant && <Text size="sm">Your ID: {localParticipant.identity}</Text>}
            </Box>

            <HStack space="md" className="justify-center items-center mt-4">
              <Button onPress={handleToggleMicrophone} variant="outline" action={isMicrophoneEnabled ? 'primary' : 'secondary'} size="lg">
                {isMicrophoneEnabled ? <Mic size={20} color="blue" /> : <MicOff size={20} color="gray" />}
                <ButtonText className="ml-2">{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</ButtonText>
              </Button>
              <Button action="negative" onPress={handleLeaveRoom} size="lg">
                <PhoneMissed size={20} color="white" />
                <ButtonText className="ml-2">Leave Call</ButtonText>
              </Button>
            </HStack>
          </VStack>
        ) : (
          <VStack space="md" className="py-2 w-full">
            <Heading size="xl" className="text-center mb-2">
              Join a Voice Call
            </Heading>
            <Text className="mb-3 text-center">
              Select a room to join:
            </Text>
            <ScrollView style={{ maxHeight: 150 }}>
              <RadioGroup value={selectedRoomForJoining || ''} onChange={(nextValue: string) => actions.setSelectedRoomForJoining(nextValue)} accessibilityLabel="Select a room">
                <VStack space="md">
                  {availableRooms.map((room: RoomInfo) => (
                    <Radio key={room.id} value={room.id} size="md">
                      <RadioIndicator className="mr-2">
                        <CircleIcon />
                      </RadioIndicator>
                      <RadioLabel>{room.name}</RadioLabel>
                    </Radio>
                  ))}
                </VStack>
              </RadioGroup>
            </ScrollView>
            <Button onPress={handleJoinRoom} isDisabled={!selectedRoomForJoining || isConnecting} className="mt-4" size="lg">
              <ButtonText>Join "{selectedRoomName || 'Room'}"</ButtonText>
            </Button>
          </VStack>
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default LiveKitCallModal;
