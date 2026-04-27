import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native';

import type { PerformCheckInInput } from '@/api/check-in-timers/check-in-timers';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import type { CheckInResult } from '@/stores/check-in-timers/store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { useToastStore } from '@/stores/toast/store';

const CHECK_IN_TYPES = [
  { value: 0, key: 'type_personnel' },
  { value: 1, key: 'type_unit' },
  { value: 2, key: 'type_ic' },
  { value: 3, key: 'type_par' },
  { value: 4, key: 'type_hazmat' },
  { value: 5, key: 'type_sector_rotation' },
  { value: 6, key: 'type_rehab' },
];

interface CheckInBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  callId: number;
}

export const CheckInBottomSheet: React.FC<CheckInBottomSheetProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const performCheckInAction = useCheckInTimerStore((state) => state.performCheckIn);
  const isCheckingIn = useCheckInTimerStore((state) => state.isCheckingIn);
  const showToast = useToastStore((state) => state.showToast);

  const defaultType = activeUnit ? 1 : 0;
  const [selectedType, setSelectedType] = useState(defaultType);
  const [note, setNote] = useState('');

  const handleConfirm = useCallback(async () => {
    const input: PerformCheckInInput = {
      CallId: callId,
      CheckInType: selectedType,
      UnitId: activeUnit ? parseInt(activeUnit.UnitId, 10) : undefined,
      Latitude: latitude?.toString(),
      Longitude: longitude?.toString(),
      Note: note || undefined,
    };

    const result: CheckInResult = await performCheckInAction(input);

    if (result === 'success') {
      showToast('success', t('check_in.check_in_success'));
      setNote('');
      onClose();
    } else if (result === 'queued') {
      showToast('info', t('check_in.queued_offline'));
      setNote('');
      onClose();
    } else {
      showToast('error', t('check_in.check_in_error'));
    }
  }, [callId, selectedType, activeUnit, latitude, longitude, note, performCheckInAction, showToast, t, onClose]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[67]} isLoading={isCheckingIn} loadingText={t('common.submitting')}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('check_in.perform_check_in')}</Heading>

        {/* Type selector */}
        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600">{t('check_in.select_type')}</Text>
          <HStack className="flex-wrap" space="sm">
            {CHECK_IN_TYPES.map((type) => (
              <Button key={type.value} variant={selectedType === type.value ? 'solid' : 'outline'} size="sm" onPress={() => setSelectedType(type.value)} className="mb-1">
                <ButtonText>{t(`check_in.${type.key}`)}</ButtonText>
              </Button>
            ))}
          </HStack>
        </VStack>

        {/* Note input */}
        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600">{t('check_in.add_note')}</Text>
          <Box className="rounded-lg border border-outline-200 p-2">
            <TextInput value={note} onChangeText={setNote} placeholder={t('check_in.add_note')} multiline numberOfLines={3} style={{ minHeight: 60, textAlignVertical: 'top' }} />
          </Box>
        </VStack>

        {/* Confirm */}
        <Button variant="solid" size="lg" onPress={handleConfirm} isDisabled={isCheckingIn}>
          <ButtonText>{t('check_in.confirm')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};
