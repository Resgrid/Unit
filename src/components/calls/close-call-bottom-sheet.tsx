import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const showToast = useToastStore((state) => state.showToast);
  const { closeCall } = useCallDetailStore();
  const { fetchCalls } = useCallsStore();
  const [closeCallType, setCloseCallType] = useState('');
  const [closeCallNote, setCloseCallNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      // Refresh the call list
      await fetchCalls();

      // Navigate back to close the call detail screen
      router.back();
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
    <CustomBottomSheet isOpen={isOpen} onClose={handleClose} isLoading={isButtonDisabled}>
      <VStack className="w-full flex-1 space-y-4 p-4">
        <Text className="text-center text-lg font-semibold">{t('call_detail.close_call')}</Text>

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

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t('call_detail.close_call_note')}</FormControlLabelText>
          </FormControlLabel>
          <Textarea>
            <TextareaInput placeholder={t('call_detail.close_call_note_placeholder')} value={closeCallNote} onChangeText={setCloseCallNote} numberOfLines={4} testID="close-call-note-input" />
          </Textarea>
        </FormControl>

        <HStack className="space-x-3 pt-10">
          <Button variant="outline" className="mr-4 flex-1" onPress={handleClose} disabled={isButtonDisabled} size={isLandscape ? 'md' : 'sm'}>
            <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('common.cancel')}</ButtonText>
          </Button>
          <Button className="ml-4 flex-1" onPress={handleSubmit} disabled={isButtonDisabled} size={isLandscape ? 'md' : 'sm'}>
            <ButtonText className={isLandscape ? '' : 'text-xs'}>{t('call_detail.close_call')}</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </CustomBottomSheet>
  );
};
