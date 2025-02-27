import React from 'react';

import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useNotesStore } from '@/stores/notes/store';
import { BottomSheet } from '../ui/bottomsheet';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { HStack } from '../ui/hstack';
import { Heading } from '../ui/heading';
import { CloseIcon, Icon } from '../ui/icon';
import { VStack } from '../ui/vstack';
import { Divider } from '../ui/divider';
import { Badge } from '../ui/badge';
import { Text } from '../ui/text';
import { PencilIcon, Trash2Icon } from 'lucide-react-native';
export const NoteDetailsSheet: React.FC = () => {
  const { t } = useTranslation();
  const { notes, selectedNoteId, isDetailsOpen, closeDetails, deleteNote } =
    useNotesStore();

  const selectedNote = notes.find((note) => note.id === selectedNoteId);

  if (!selectedNote) return null;

  return (
    <BottomSheet
      isOpen={isDetailsOpen}
      onClose={closeDetails}
      snapPoints={['60%', '90%']}
    >
      <Box className="p-4 bg-white dark:bg-gray-900 rounded-t-xl">
        <HStack className="justify-between items-center mb-4">
          <Heading size="lg" className="text-gray-800 dark:text-gray-100">
            {t('notes.details.title')}
          </Heading>
          <Button variant="link" onPress={closeDetails} className="p-1">
            <Icon as={CloseIcon} size="md" />
          </Button>
        </HStack>

        <VStack space="md">
          <Heading size="md" className="text-gray-800 dark:text-gray-100">
            {selectedNote.title}
          </Heading>

          <Divider />

          <Text className="text-gray-700 dark:text-gray-300">
            {selectedNote.content}
          </Text>

          <Divider />

          <HStack className="flex-wrap">
            <Text className="font-semibold mr-2 text-gray-700 dark:text-gray-300">
              {t('notes.details.tags')}:
            </Text>
            {selectedNote.tags?.map((tag) => (
              <Badge
                key={tag}
                className="mr-1 mb-1 bg-blue-100 dark:bg-blue-900"
              >
                <Text className="text-xs text-blue-800 dark:text-blue-100">
                  {tag}
                </Text>
              </Badge>
            ))}
          </HStack>

          <VStack space="xs">
            <HStack>
              <Text className="font-semibold mr-2 text-gray-700 dark:text-gray-300">
                {t('notes.details.created')}:
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                {format(new Date(selectedNote.createdAt), 'PPpp')}
              </Text>
            </HStack>

            <HStack>
              <Text className="font-semibold mr-2 text-gray-700 dark:text-gray-300">
                {t('notes.details.updated')}:
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                {format(new Date(selectedNote.updatedAt), 'PPpp')}
              </Text>
            </HStack>
          </VStack>

          <HStack className="justify-between mt-4">
            <Button
              variant="outline"
              className="flex-1 mr-2 border-red-500"
              onPress={() => {
                deleteNote(selectedNote.id);
                closeDetails();
              }}
            >
              <Icon as={Trash2Icon} size="sm" color="red" />
              <ButtonText className="text-red-500 ml-1">
                {t('notes.details.delete')}
              </ButtonText>
            </Button>

            <Button
              className="flex-1 ml-2 bg-blue-500"
              onPress={() => {
                // Edit functionality would go here
                closeDetails();
              }}
            >
              <Icon as={PencilIcon} size="sm" color="white" />
              <ButtonText className="text-white ml-1">
                {t('notes.details.edit')}
              </ButtonText>
            </Button>
          </HStack>
        </VStack>
      </Box>
    </BottomSheet>
  );
};
