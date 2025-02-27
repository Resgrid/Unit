import React from 'react';
import { Pressable, useWindowDimensions } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { format } from 'date-fns';
import type { CallResultData } from '@/models/v4/calls/callResultData';
import { Icon } from '@/components/ui/icon';
import { MapPin, Phone, Calendar, AlertTriangle } from 'lucide-react-native';
import RenderHtml from 'react-native-render-html';
import { CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { invertColor } from '@/lib/utils';

function getColor(
  call: CallResultData,
  priority: CallPriorityResultData | undefined
) {
  if (!call) {
    return '#808080';
  } else if (call.CallId === '0') {
    return '#808080';
  } else if (priority && priority.Color) {
    return priority.Color;
  }

  return '#808080';
}

interface CallCardProps {
  call: CallResultData;
  priority: CallPriorityResultData | undefined;
}

export const CallCard: React.FC<CallCardProps> = ({ call, priority }) => {
  const { width } = useWindowDimensions();
  const textColor = invertColor(getColor(call, priority), true);

  return (
    <Box
      style={{
        backgroundColor: getColor(call, priority),
      }}
      className={`p-4 rounded-xl shadow-sm mb-4`}
    >
      {/* Header with Call Number and Priority */}
      <HStack className="justify-between items-center mb-4">
        <HStack className="items-center space-x-2">
          <AlertTriangle size={20} />
          <Text
            style={{
              color: textColor,
            }}
            className={`font-bold text-lg`}
          >
            #{call.Number}
          </Text>
        </HStack>
        <Text
          style={{
            color: textColor,
          }}
          className="text-gray-600 text-sm"
        >
          {format(new Date(call.LoggedOn), 'MMM d, h:mm a')}
        </Text>
      </HStack>

      {/* Call Details */}
      <VStack className="space-y-3">
        {/* Name */}
        <HStack className="items-center space-x-2">
          <Icon as={Phone} className="text-gray-500" size="md" />
          <Text
            style={{
              color: textColor,
            }}
            className="text-gray-900 font-medium"
          >
            {call.Name}
          </Text>
        </HStack>

        {/* Address */}
        <HStack className="items-center space-x-2">
          <Icon as={MapPin} className="text-gray-500" size="md" />
          <Text
            style={{
              color: textColor,
            }}
            className="text-gray-700"
          >
            {call.Address}
          </Text>
        </HStack>

        {/* Dispatched Time */}
        <HStack className="items-center space-x-2">
          <Icon as={Calendar} className="text-gray-500" size="md" />
          <Text className="text-gray-600 text-sm">
            Dispatched: {format(new Date(call.DispatchedOn), 'PPp')}
          </Text>
        </HStack>
      </VStack>

      {/* Nature of Call */}
      {call.Nature && (
        <Box className="mt-4 p-3 bg-white/50 rounded-lg">
          <Text style={{ color: textColor }} className="text-gray-800">
            <RenderHtml
              contentWidth={width}
              source={{ html: call.Nature }}
              tagsStyles={{
                body: {
                  color: textColor,
                  fontSize: 16,
                },
                p: {
                  margin: 0,
                  padding: 0,
                },
              }}
            />
          </Text>
        </Box>
      )}
    </Box>
  );
};
