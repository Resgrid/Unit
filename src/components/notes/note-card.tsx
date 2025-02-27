import React from 'react';

import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Note } from '@/stores/notes/store';
import { Box } from '../ui/box';
import { Pressable } from 'react-native';
import { VStack } from '../ui/vstack';
import { HStack } from '../ui/hstack';
import { Badge } from '../ui/badge';
import { Text } from '../ui/text';
interface NoteCardProps {
  note: Note;
  onPress: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onPress }) => {
  const { t } = useTranslation();

  return (
    <Pressable onPress={() => onPress(note.id)}>
      <Box className="p-4 mb-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <VStack space="xs">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {note.title}
          </Text>
          <Text
            className="text-sm text-gray-600 dark:text-gray-300"
            numberOfLines={2}
          >
            {note.content}
          </Text>
          <HStack className="mt-2 flex-wrap">
            {note.tags?.map((tag) => (
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
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {format(new Date(note.updatedAt), 'MMM d, yyyy')}
          </Text>
        </VStack>
      </Box>
    </Pressable>
  );
};
