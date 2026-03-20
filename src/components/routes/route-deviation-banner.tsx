import { AlertTriangle, X } from 'lucide-react-native';
import React from 'react';
import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { type RouteDeviationResultData } from '@/models/v4/routes/routeDeviationResultData';

interface RouteDeviationBannerProps {
  deviations: RouteDeviationResultData[];
  onPress: () => void;
  onDismiss: (deviationId: string) => void;
}

export const RouteDeviationBanner: React.FC<RouteDeviationBannerProps> = ({ deviations, onPress, onDismiss }) => {
  if (deviations.length === 0) {
    return null;
  }

  const latestDeviation = deviations[0];

  return (
    <Pressable onPress={onPress}>
      <Box className="mx-4 mb-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/30">
        <HStack className="items-center justify-between">
          <HStack className="flex-1 items-center space-x-2">
            <Icon as={AlertTriangle} size="sm" className="text-amber-600" />
            <Text className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-200" numberOfLines={1}>
              {latestDeviation.Description}
            </Text>
          </HStack>

          {deviations.length > 1 ? (
            <Box className="mr-2 rounded-full bg-amber-200 px-2 py-0.5 dark:bg-amber-800">
              <Text className="text-xs font-bold text-amber-800 dark:text-amber-200">+{deviations.length - 1}</Text>
            </Box>
          ) : null}

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onDismiss(latestDeviation.RouteDeviationId);
            }}
          >
            <Icon as={X} size="sm" className="text-amber-500" />
          </Pressable>
        </HStack>
      </Box>
    </Pressable>
  );
};
