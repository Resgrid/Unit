import { Pressable } from 'react-native';

import { formatDateForDisplay, parseDateISOString, stripHtmlTags } from '@/lib/utils';
import { type CallProtocolsResultData } from '@/models/v4/callProtocols/callProtocolsResultData';

import { Badge } from '../ui/badge';
import { Box } from '../ui/box';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface ProtocolCardProps {
  protocol: CallProtocolsResultData;
  onPress: (id: string) => void;
}

export const ProtocolCard: React.FC<ProtocolCardProps> = ({ protocol, onPress }) => {
  return (
    <Pressable onPress={() => onPress(protocol.Id)}>
      <Box className="mb-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
        <VStack space="xs">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">{protocol.Name}</Text>
          {protocol.Code && (
            <Badge className="w-fit bg-blue-100 dark:bg-blue-900">
              <Text className="text-xs text-blue-800 dark:text-blue-100">{protocol.Code}</Text>
            </Badge>
          )}
          <Text className="text-sm text-gray-600 dark:text-gray-300" numberOfLines={2}>
            {protocol.Description ? stripHtmlTags(protocol.Description) : ''}
          </Text>
          <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">{formatDateForDisplay(parseDateISOString(protocol.UpdatedOn || protocol.CreatedOn), 'yyyy-MM-dd HH:mm Z')}</Text>
        </VStack>
      </Box>
    </Pressable>
  );
};
