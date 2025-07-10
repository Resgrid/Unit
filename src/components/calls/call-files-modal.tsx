import React from 'react';

import { Heading } from '@/components/ui/heading';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface CallFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

export const CallFilesModal: React.FC<CallFilesModalProps> = ({ isOpen, onClose, callId }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalBackdrop />
      <ModalContent testID="call-files-modal">
        <ModalHeader>
          <Heading size="md">Call Files</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack space="md">
            <Text>Files for call {callId}</Text>
            {/* TODO: Implement file list functionality */}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CallFilesModal;
