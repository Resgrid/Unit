import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useQuickCheckIn } from '@/hooks/use-quick-check-in';
import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';

import { CheckInBottomSheet } from './check-in-bottom-sheet';
import { CheckInHistoryList } from './check-in-history-list';
import { CheckInTimerCard } from './check-in-timer-card';

interface CheckInTabContentProps {
  callId: number;
}

export const CheckInTabContent: React.FC<CheckInTabContentProps> = ({ callId }) => {
  const { t } = useTranslation();
  const timerStatuses = useCheckInTimerStore((state) => state.timerStatuses);
  const checkInHistory = useCheckInTimerStore((state) => state.checkInHistory);
  const isLoadingStatuses = useCheckInTimerStore((state) => state.isLoadingStatuses);
  const fetchCheckInHistory = useCheckInTimerStore((state) => state.fetchCheckInHistory);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { quickCheckIn, isCheckingIn } = useQuickCheckIn(callId);

  useEffect(() => {
    if (showHistory) {
      fetchCheckInHistory(callId);
    }
  }, [showHistory, callId, fetchCheckInHistory]);

  const handleCardCheckIn = useCallback(() => {
    setIsBottomSheetOpen(true);
  }, []);

  const renderTimerCard = useCallback(({ item }: { item: CheckInTimerStatusResultData }) => <CheckInTimerCard timer={item} onCheckIn={handleCardCheckIn} />, [handleCardCheckIn]);

  const keyExtractor = useCallback((item: CheckInTimerStatusResultData) => `${item.TargetEntityId}-${item.TargetType}`, []);

  if (timerStatuses.length === 0 && !isLoadingStatuses) {
    return (
      <Box className="p-4">
        <Text className="text-center text-gray-500">{t('check_in.no_timers')}</Text>
      </Box>
    );
  }

  return (
    <VStack className="p-4" space="md">
      {/* Quick Check-In button */}
      <Button variant="solid" size="lg" onPress={quickCheckIn} disabled={isCheckingIn} className="bg-green-600">
        <ButtonText className="text-white">{t('check_in.quick_check_in')}</ButtonText>
      </Button>

      {/* Timer cards */}
      <FlatList data={timerStatuses} renderItem={renderTimerCard} keyExtractor={keyExtractor} scrollEnabled={false} removeClippedSubviews={true} maxToRenderPerBatch={10} />

      {/* History section */}
      <HStack className="items-center justify-between">
        <Heading size="sm">{t('check_in.history')}</Heading>
        <Button variant="link" size="sm" onPress={() => setShowHistory(!showHistory)}>
          <ButtonText>{showHistory ? t('common.close') : t('check_in.history')}</ButtonText>
        </Button>
      </HStack>

      {showHistory ? <CheckInHistoryList records={checkInHistory} /> : null}

      <CheckInBottomSheet isOpen={isBottomSheetOpen} onClose={() => setIsBottomSheetOpen(false)} callId={callId} />
    </VStack>
  );
};
