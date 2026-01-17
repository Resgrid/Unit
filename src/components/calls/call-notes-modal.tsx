import { SearchIcon, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Keyboard, Modal, SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

import { useAnalytics } from '@/hooks/use-analytics';
import { useAuthStore } from '@/lib/auth';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import { Loading } from '../common/loading';
import ZeroState from '../common/zero-state';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Input, InputField, InputSlot } from '../ui/input';
import { Text } from '../ui/text';
import { Textarea, TextareaInput } from '../ui/textarea';
import { VStack } from '../ui/vstack';

interface CallNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

const CallNotesModal = ({ isOpen, onClose, callId }: CallNotesModalProps) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [newNote, setNewNote] = useState('');
  const { callNotes, addNote, searchNotes, isNotesLoading, fetchCallNotes } = useCallDetailStore();
  const { profile } = useAuthStore();

  const isDark = colorScheme === 'dark';

  // Fetch call notes when modal opens
  useEffect(() => {
    if (isOpen && callId) {
      fetchCallNotes(callId);
    }
  }, [isOpen, callId, fetchCallNotes]);

  // Track when call notes modal is opened/rendered
  useEffect(() => {
    if (isOpen) {
      trackEvent('call_notes_modal_opened', {
        callId: callId,
        existingNotesCount: callNotes.length,
        hasSearchQuery: searchQuery.length > 0,
        isNotesLoading: isNotesLoading,
      });
    }
  }, [isOpen, trackEvent, callId, callNotes.length, searchQuery.length, isNotesLoading]);

  const filteredNotes = useMemo(() => {
    return searchNotes(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchNotes, callNotes]);

  // Get current user from profile
  const currentUser = profile?.sub || '';

  const handleAddNote = useCallback(async () => {
    if (newNote.trim()) {
      try {
        await addNote(callId, newNote, currentUser, null, null);
        setNewNote('');
        Keyboard.dismiss();
      } catch (error) {
        console.error('Failed to add note:', error);
      }
    }
  }, [newNote, callId, currentUser, addNote]);

  const handleClose = useCallback(() => {
    setNewNote('');
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const renderNote = useCallback(
    ({ item: note }: { item: (typeof filteredNotes)[0] }) => (
      <Box className="mb-3 w-full rounded-lg bg-gray-50 p-4 shadow-sm dark:bg-gray-700">
        <Text className="mb-2 text-gray-800 dark:text-gray-200">{note.Note}</Text>
        <HStack className="w-full justify-between">
          <Text className="text-xs text-gray-500 dark:text-gray-400">{note.FullName}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">{note.TimestampFormatted}</Text>
        </HStack>
      </Box>
    ),
    []
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        {/* Header */}
        <View style={[styles.header, isDark && styles.headerDark]}>
          <Heading size="lg">{t('callNotes.title')}</Heading>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} testID="close-button">
            <X size={24} color={isDark ? '#D1D5DB' : '#374151'} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Input className="w-full rounded-lg bg-gray-100 dark:bg-gray-700">
            <InputSlot>
              <SearchIcon size={20} className="text-gray-500" />
            </InputSlot>
            <InputField placeholder={t('callNotes.searchPlaceholder')} value={searchQuery} onChangeText={setSearchQuery} />
          </Input>
        </View>

        {/* Notes List */}
        <View style={styles.listContainer}>
          {isNotesLoading ? (
            <Loading />
          ) : filteredNotes.length > 0 ? (
            <FlatList
              data={filteredNotes}
              renderItem={renderNote}
              keyExtractor={(item) => item.CallNoteId}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <ZeroState heading={t('callNotes.noNotesFound')} />
          )}
        </View>

        {/* Add Note Section - Sticks to keyboard */}
        <KeyboardStickyView offset={{ opened: 0, closed: 0 }}>
          <View style={[styles.footer, isDark && styles.footerDark]}>
            <VStack space="sm" className="w-full">
              <Text className="font-medium">{t('callNotes.addNoteLabel')}</Text>
              <Textarea size="md" className="min-h-[70px] w-full">
                <TextareaInput placeholder={t('callNotes.addNotePlaceholder')} value={newNote} onChangeText={setNewNote} testID="new-note-input" />
              </Textarea>
            </VStack>

            <HStack space="sm" className="mt-3 w-full justify-between">
              <Button variant="outline" onPress={handleClose} testID="cancel-button" className="flex-1">
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button onPress={handleAddNote} className="flex-1 bg-blue-600 dark:bg-blue-500" isDisabled={!newNote.trim() || isNotesLoading}>
                <ButtonText>{t('callNotes.addNote')}</ButtonText>
              </Button>
            </HStack>
          </View>
        </KeyboardStickyView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    borderBottomColor: '#374151',
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  footerDark: {
    borderTopColor: '#374151',
    backgroundColor: '#1F2937',
  },
});

export default CallNotesModal;
