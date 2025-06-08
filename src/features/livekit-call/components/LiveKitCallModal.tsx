import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  Box,
  Button,
  ButtonText,
  Heading,
  HStack,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { CircleIcon, Radio, RadioGroup, RadioIcon, RadioIndicator, RadioLabel } from '@gluestack-ui/themed';
import { AlertTriangle, CheckCircle, Mic, MicOff, PhoneMissed } from 'lucide-react-native'; // Example icons
import React, { useEffect, useState } from 'react';

import { type RoomInfo, useLiveKitCallStore } from '../store/useLiveKitCallStore';

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
    <Actionsheet isOpen={isOpen} onClose={internalOnClose} zIndex={999}>
      <ActionsheetBackdrop />
      <ActionsheetContent maxHeight="40%" px="$4" py="$2">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {isConnecting ? (
          <VStack space="md" alignItems="center" justifyContent="center" flex={1} minHeight={150}>
            <Spinner size="large" />
            <Text>Connecting to {selectedRoomName || 'room'}...</Text>
          </VStack>
        ) : error ? (
          <VStack space="md" alignItems="center" justifyContent="center" flex={1} p="$4" minHeight={150}>
            <AlertTriangle size={48} color="$red700" />
            <Heading size="md" color="$red700">
              Connection Error
            </Heading>
            <Text textAlign="center">{error}</Text>
            <Button
              onPress={() => {
                actions._clearError();
                if (!isConnected) actions.setSelectedRoomForJoining(null);
              }}
              mt="$4"
            >
              <ButtonText>Try Again</ButtonText>
            </Button>
          </VStack>
        ) : isConnected && currentRoomId ? (
          <VStack space="lg" py="$4" flex={1} justifyContent="space-between">
            <Box>
              <HStack alignItems="center" space="sm" mb="$2">
                <CheckCircle color="$green600" size={24} />
                <Heading size="lg">Connected</Heading>
              </HStack>
              <Text>
                You are in room: <Text bold>{currentRoomName}</Text>
              </Text>
              {localParticipant && <Text size="sm">Your ID: {localParticipant.identity}</Text>}
            </Box>

            <HStack space="md" justifyContent="center" alignItems="center" mt="$4">
              <Button onPress={handleToggleMicrophone} variant="outline" action={isMicrophoneEnabled ? 'primary' : 'secondary'} size="lg">
                {isMicrophoneEnabled ? <Mic size={20} color="$primary700" /> : <MicOff size={20} color="$textLight600" />}
                <ButtonText ml="$2">{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</ButtonText>
              </Button>
              <Button action="negative" onPress={handleLeaveRoom} size="lg">
                <PhoneMissed size={20} color="$white" />
                <ButtonText ml="$2">Leave Call</ButtonText>
              </Button>
            </HStack>
          </VStack>
        ) : (
          <VStack space="md" py="$2" width="100%">
            <Heading size="xl" textAlign="center" mb="$2">
              Join a Voice Call
            </Heading>
            <Text mb="$3" textAlign="center">
              Select a room to join:
            </Text>
            <ScrollView maxHeight={150}>
              <RadioGroup value={selectedRoomForJoining || ''} onChange={(nextValue: string) => actions.setSelectedRoomForJoining(nextValue)} accessibilityLabel="Select a room">
                <VStack space="md">
                  {availableRooms.map((room: RoomInfo) => (
                    <Radio key={room.id} value={room.id} size="md">
                      <RadioIndicator mr="$2">
                        <RadioIcon as={CircleIcon} />
                      </RadioIndicator>
                      <RadioLabel>{room.name}</RadioLabel>
                    </Radio>
                  ))}
                </VStack>
              </RadioGroup>
            </ScrollView>
            <Button onPress={handleJoinRoom} isDisabled={!selectedRoomForJoining || isConnecting} mt="$4" size="lg">
              <ButtonText>Join "{selectedRoomName || 'Room'}"</ButtonText>
            </Button>
          </VStack>
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default LiveKitCallModal;
