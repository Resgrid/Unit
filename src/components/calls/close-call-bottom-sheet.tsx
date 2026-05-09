import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { useToastStore } from '@/stores/toast/store';

interface CloseCallBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  isLoading?: boolean;
}

const CLOSE_CALL_TYPES = [
  { value: '1', translationKey: 'call_detail.close_call_types.closed' },
  { value: '2', translationKey: 'call_detail.close_call_types.cancelled' },
  { value: '3', translationKey: 'call_detail.close_call_types.unfounded' },
  { value: '4', translationKey: 'call_detail.close_call_types.founded' },
  { value: '5', translationKey: 'call_detail.close_call_types.minor' },
  { value: '6', translationKey: 'call_detail.close_call_types.transferred' },
  { value: '7', translationKey: 'call_detail.close_call_types.false_alarm' },
];

export const CloseCallBottomSheet: React.FC<CloseCallBottomSheetProps> = ({ isOpen, onClose, callId, isLoading = false }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { trackEvent } = useAnalytics();
  const closeCall = useCallDetailStore((state) => state.closeCall);
  const fetchCalls = useCallsStore((state) => state.fetchCalls);
  const [closeCallType, setCloseCallType] = useState('');
  const [closeCallNote, setCloseCallNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // Track when close call bottom sheet is opened/rendered
  React.useEffect(() => {
    if (isOpen) {
      trackEvent('close_call_bottom_sheet_opened', {
        callId: callId,
        isLoading: isLoading,
      });
    }
  }, [isOpen, trackEvent, callId, isLoading]);

  const handleClose = React.useCallback(() => {
    setCloseCallType('');
    setCloseCallNote('');
    setIsTypeDropdownOpen(false);
    onClose();
  }, [onClose]);

  const handleSubmit = React.useCallback(async () => {
    if (!closeCallType) {
      showToast('error', t('call_detail.close_call_type_required'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the closeCall API
      await closeCall({
        callId,
        type: parseInt(closeCallType),
        note: closeCallNote,
      });

      // Show success toast
      showToast('success', t('call_detail.close_call_success'));

      // Close the bottom sheet
      handleClose();

      // Navigate back to the calls list and refresh
      router.replace('/(app)/calls');
      await fetchCalls();
    } catch (error) {
      console.error('Error closing call:', error);
      // Show error toast
      showToast('error', t('call_detail.close_call_error'));
    } finally {
      setIsSubmitting(false);
    }
  }, [closeCallType, showToast, t, callId, closeCallNote, handleClose, fetchCalls, router, closeCall]);

  const selectedTypeLabel = closeCallType ? t(CLOSE_CALL_TYPES.find((ct) => ct.value === closeCallType)?.translationKey ?? '') : t('call_detail.close_call_type_placeholder');

  const isButtonDisabled = isLoading || isSubmitting;

  return (
    <Modal visible={isOpen} transparent={true} animationType="slide" onRequestClose={handleClose} testID="close-call-bottom-sheet">
      <RNPressable style={styles.backdrop} onPress={handleClose}>
        <RNPressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <KeyboardAwareScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={120}>
            <VStack space="md" className="w-full p-4">
              <Text className="mb-4 text-center text-lg font-semibold">{t('call_detail.close_call')}</Text>

              {/* Close Call Type selector */}
              <VStack space="sm">
                <Text className="font-medium">{t('call_detail.close_call_type')}</Text>
                <RNPressable style={styles.typeTrigger} onPress={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)} testID="close-call-type-select">
                  <Text style={closeCallType ? styles.typeText : styles.typePlaceholder}>{selectedTypeLabel}</Text>
                  <ChevronDown size={18} color="#6B7280" />
                </RNPressable>

                {isTypeDropdownOpen && (
                  <View style={styles.typeDropdown} testID="close-call-type-dropdown">
                    {CLOSE_CALL_TYPES.map((type) => (
                      <RNPressable
                        key={type.value}
                        style={[styles.typeOption, closeCallType === type.value && styles.typeOptionSelected]}
                        onPress={() => {
                          setCloseCallType(type.value);
                          setIsTypeDropdownOpen(false);
                        }}
                        testID={`close-call-type-option-${type.value}`}
                      >
                        <Text style={closeCallType === type.value ? styles.typeOptionTextSelected : styles.typeOptionText}>{t(type.translationKey)}</Text>
                      </RNPressable>
                    ))}
                  </View>
                )}
              </VStack>

              <VStack space="sm">
                <Text className="font-medium">{t('call_detail.close_call_note')}</Text>
                <Textarea size="md" className="min-h-[100px] w-full">
                  <TextareaInput placeholder={t('call_detail.close_call_note_placeholder')} value={closeCallNote} onChangeText={setCloseCallNote} testID="close-call-note-input" />
                </Textarea>
              </VStack>

              <HStack space="xs" className="mt-2 justify-between px-4">
                <Button variant="outline" onPress={handleClose} disabled={isButtonDisabled} className="px-3">
                  <ButtonText className="text-sm">{t('common.cancel')}</ButtonText>
                </Button>
                <Button onPress={handleSubmit} disabled={isButtonDisabled} className="bg-blue-600 px-4 py-2">
                  <ButtonText className="text-sm">{t('call_detail.close_call')}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </KeyboardAwareScrollView>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingBottom: 34,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  scrollView: {
    width: '100%',
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  typeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  typeText: {
    fontSize: 16,
    color: '#111827',
  },
  typePlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  typeDropdown: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: 'white',
    marginTop: 4,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  typeOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  typeOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  typeOptionTextSelected: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },
});
