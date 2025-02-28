import React, { useState, useEffect } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Search, X, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { 
  Actionsheet, 
  ActionsheetBackdrop, 
  ActionsheetContent, 
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from '../ui/actionsheet';
import { Heading } from '../ui/heading';
import { Button, ButtonText } from '../ui/button';
import { VStack } from '../ui/vstack';
import { Input } from '../ui/input';
import { InputSlot } from '../ui/input';
import { InputField } from '../ui/input';
import { HStack } from '../ui/hstack';
import { Divider } from '../ui/divider';
import { Text } from '../ui/text';
import { Textarea } from '../ui/textarea';
import { TextareaInput } from '../ui/textarea';
import { Box } from '../ui/box';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useAuthStore } from '@/lib/auth';
import { Loading } from '../ui/loading';
import ZeroState from '../common/zero-state';


interface CallNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

const CallNotesModal = ({ isOpen, onClose, callId }: CallNotesModalProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [newNote, setNewNote] = useState('');
  const { callNotes, addNote, searchNotes, isNotesLoading } = useCallDetailStore();
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
      <ActionsheetContent className="rounded-t-xl bg-white dark:bg-gray-800 w-full">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        
        {/* Header */}
        <Box className="px-4 pt-2 pb-4 border-b border-gray-200 dark:border-gray-700 flex-row justify-between items-center w-full">
          <Heading size="lg">{t('callNotes.title')}</Heading>
          <Button
            variant="link"
            onPress={onClose}
            className="p-1"
          >
            <X size={24} />
          </Button>
        </Box>
        
        {/* Body */}
        <Box className="p-4 flex-1 bg-white dark:bg-gray-800 w-full">
          {isNotesLoading ? (
            <Loading />
          ) : (
            <VStack space="md" className="w-full h-full">
              {/* Search Bar */}
            <Input className="bg-gray-100 dark:bg-gray-700 rounded-lg w-full">
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
            <ScrollView className="flex-1 max-h-[40vh] w-full h-full">
              <VStack space="md" className="pb-4 w-full">
                {filteredNotes.length > 0 ? (
                  filteredNotes.map((note) => (
                    <Box 
                      key={note.CallNoteId} 
                      className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm w-full"
                    >
                      <Text className="text-gray-800 dark:text-gray-200 mb-2">
                        {note.Note}
                      </Text>
                      <HStack className="justify-between w-full">
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
        <Box className="p-4 bg-gray-50 dark:bg-gray-900 w-full">
          <VStack space="md" className="w-full">
            <Textarea className="bg-white dark:bg-gray-700 rounded-lg w-full">
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