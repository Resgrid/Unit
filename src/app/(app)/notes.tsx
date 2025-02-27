import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { Feather } from '@expo/vector-icons';
import { useNotesStore } from '@/stores/notes/store';
import { NoteCard } from '@/components/notes/note-card';
import { NoteDetailsSheet } from '@/components/notes/note-details-sheet';
import { Box } from '@/components/ui/box';
import { FlatList, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Fab, FabIcon } from '@/components/ui/fab';

export default function Notes() {
  const { t } = useTranslation();
  const { notes, searchQuery, setSearchQuery, selectNote } = useNotesStore();

  const filteredNotes = React.useMemo(() => {
    if (!searchQuery.trim()) return notes;

    const query = searchQuery.toLowerCase();
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [notes, searchQuery]);

  return (
    <>
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Box className="flex-1 px-4 pt-4">
          <Heading size="xl" className="mb-4 text-gray-800 dark:text-gray-100">
            {t('notes.title')}
          </Heading>

          <Input
            className="mb-4 bg-white dark:bg-gray-800 rounded-lg"
            size="md"
            variant="outline"
          >
            <InputSlot className="pl-3">
              <InputIcon as={Feather} />
            </InputSlot>
            <InputField
              placeholder={t('notes.search')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
                <InputIcon as={Feather} />
              </InputSlot>
            ) : null}
          </Input>

          {filteredNotes.length > 0 ? (
            <FlatList
              data={filteredNotes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <NoteCard note={item} onPress={selectNote} />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          ) : (
            <Box className="flex-1 justify-center items-center">
              <Text className="text-gray-500 dark:text-gray-400">
                {t('notes.empty')}
              </Text>
            </Box>
          )}

          <Fab placement="bottom right" className="bg-blue-500" size="lg">
            <FabIcon as={Feather} />
          </Fab>
        </Box>

        <NoteDetailsSheet />
      </View>
    </>
  );
}
