import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Button, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
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

  const isButtonDisabled = isLoading || isSubmitting;

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-white dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <KeyboardAwareScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={120}>
          <VStack space="md" className="w-full p-4">
            <Text className="mb-4 text-center text-lg font-semibold">{t('call_detail.close_call')}</Text>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t('call_detail.close_call_type')}</FormControlLabelText>
              </FormControlLabel>
              <Select selectedValue={closeCallType} onValueChange={setCloseCallType} testID="close-call-type-select">
                <SelectTrigger>
                  <SelectInput placeholder={t('call_detail.close_call_type_placeholder')} />
                  <SelectIcon />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectItem label={t('call_detail.close_call_types.closed')} value="1" />
                    <SelectItem label={t('call_detail.close_call_types.cancelled')} value="2" />
                    <SelectItem label={t('call_detail.close_call_types.unfounded')} value="3" />
                    <SelectItem label={t('call_detail.close_call_types.founded')} value="4" />
                    <SelectItem label={t('call_detail.close_call_types.minor')} value="5" />
                    <SelectItem label={t('call_detail.close_call_types.transferred')} value="6" />
                    <SelectItem label={t('call_detail.close_call_types.false_alarm')} value="7" />
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>

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
      </ActionsheetContent>
    </Actionsheet>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
});
