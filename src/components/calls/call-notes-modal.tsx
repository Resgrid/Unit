import { Search, Send, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions } from 'react-native';

import { useAuthStore } from '@/lib/auth';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import ZeroState from '../common/zero-state';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { Divider } from '../ui/divider';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Input } from '../ui/input';
import { InputSlot } from '../ui/input';
import { InputField } from '../ui/input';
import { Loading } from '../ui/loading';
import { Text } from '../ui/text';
import { Textarea } from '../ui/textarea';
import { TextareaInput } from '../ui/textarea';
import { VStack } from '../ui/vstack';

interface CallNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

const CallNotesModal = ({ isOpen, onClose, callId }: CallNotesModalProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [newNote, setNewNote] = useState('');
  const { callNotes, addNote, searchNotes, isNotesLoading } =
    useCallDetailStore();
  const { profile } = useAuthStore();
  const { height, width } = useWindowDimensions();

  const filteredNotes = React.useMemo(() => {
    return searchNotes(searchQuery);
  }, [searchQuery, searchNotes]);

  // Mock user for now - in a real app, this would come from authentication
  const currentUser = profile?.sub || '';

  const handleAddNote = async () => {
    if (newNote.trim()) {
      await addNote(callId, newNote, currentUser, null, null);
      setNewNote('');
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[67]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="w-full rounded-t-xl bg-white dark:bg-gray-800">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header */}
        <Box className="w-full flex-row items-center justify-between border-b border-gray-200 px-4 pb-4 pt-2 dark:border-gray-700">
          <Heading size="lg">{t('callNotes.title')}</Heading>
          <Button variant="link" onPress={onClose} className="p-1">
            <X size={24} />
          </Button>
        </Box>

        {/* Body */}
        <Box className="w-full flex-1 bg-white p-4 dark:bg-gray-800">
          {isNotesLoading ? (
            <Loading />
          ) : (
            <VStack space="md" className="size-full">
              {/* Search Bar */}
              <Input className="w-full rounded-lg bg-gray-100 dark:bg-gray-700">
                <InputSlot className="pl-3">
                  <Search size={20} />
                </InputSlot>
                <InputField
                  placeholder={t('callNotes.searchPlaceholder')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </Input>

              {/* Notes List */}
              <ScrollView className="size-full max-h-[40vh] flex-1">
                <VStack space="md" className="w-full pb-4">
                  {filteredNotes.length > 0 ? (
                    filteredNotes.map((note) => (
                      <Box
                        key={note.CallNoteId}
                        className="w-full rounded-lg bg-gray-50 p-4 shadow-sm dark:bg-gray-700"
                      >
                        <Text className="mb-2 text-gray-800 dark:text-gray-200">
                          {note.Note}
                        </Text>
                        <HStack className="w-full justify-between">
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {note.FullName}
                          </Text>
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {note.TimestampFormatted}
                          </Text>
                        </HStack>
                      </Box>
                    ))
                  ) : (
                    <ZeroState heading="No notes found" />
                  )}
                </VStack>
              </ScrollView>
            </VStack>
          )}
        </Box>

        <Divider />

        {/* Footer */}
        <Box className="w-full bg-gray-50 p-4 dark:bg-gray-900">
          <VStack space="md" className="w-full">
            <Textarea className="w-full rounded-lg bg-white dark:bg-gray-700">
              <TextareaInput
                placeholder={t('callNotes.addNotePlaceholder')}
                value={newNote}
                onChangeText={setNewNote}
                autoCorrect={false}
                className="min-h-[80px] w-full"
              />
            </Textarea>
            <HStack className="w-full justify-end">
              <Button
                onPress={handleAddNote}
                className="bg-blue-600 dark:bg-blue-500"
                isDisabled={!newNote.trim()}
              >
                <HStack space="xs" className="text-center">
                  <ButtonText>{t('callNotes.addNote')}</ButtonText>
                  <Send size={16} color="white" />
                </HStack>
              </Button>
            </HStack>
          </VStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default CallNotesModal;
