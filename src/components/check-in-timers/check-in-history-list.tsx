import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { CheckInRecordResultData } from '@/models/v4/checkIn/checkInRecordResultData';

interface CheckInHistoryListProps {
  records: CheckInRecordResultData[];
}

const renderItem = ({ item }: { item: CheckInRecordResultData }) => (
  <Box className="border-b border-outline-50 py-2">
    <HStack className="items-center justify-between">
      <VStack className="flex-1">
        <Text className="text-sm font-medium">{item.CheckInTypeName}</Text>
        <Text className="text-xs text-gray-500">{item.UnitId ? `Unit: ${item.UnitId}` : `User: ${item.UserId}`}</Text>
        {item.Note ? <Text className="text-xs text-gray-400">{item.Note}</Text> : null}
      </VStack>
      <Text className="text-xs text-gray-500">{new Date(item.Timestamp).toLocaleString()}</Text>
    </HStack>
  </Box>
);

const keyExtractor = (item: CheckInRecordResultData) => item.CheckInRecordId;

export const CheckInHistoryList: React.FC<CheckInHistoryListProps> = ({ records }) => {
  const { t } = useTranslation();

  if (records.length === 0) {
    return (
      <Box className="p-4">
        <Text className="text-center text-gray-500">{t('check_in.history')}</Text>
      </Box>
    );
  }

  return <FlatList data={records} renderItem={renderItem} keyExtractor={keyExtractor} removeClippedSubviews={true} maxToRenderPerBatch={10} windowSize={5} />;
};
