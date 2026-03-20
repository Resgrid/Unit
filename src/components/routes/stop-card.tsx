import { CheckCircle, Circle, Clock, MapPin, Phone, SkipForward, User } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type RouteInstanceStopResultData, RouteStopStatus } from '@/models/v4/routes/routeInstanceStopResultData';

interface StopCardProps {
  stop: RouteInstanceStopResultData;
  isCurrent?: boolean;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onSkip?: () => void;
  onPress?: () => void;
}

const statusConfig = {
  [RouteStopStatus.Pending]: { color: '#9ca3af', labelKey: 'routes.pending', icon: Circle },
  [RouteStopStatus.InProgress]: { color: '#3b82f6', labelKey: 'routes.in_progress', icon: Clock },
  [RouteStopStatus.Completed]: { color: '#22c55e', labelKey: 'routes.completed', icon: CheckCircle },
  [RouteStopStatus.Skipped]: { color: '#eab308', labelKey: 'routes.skipped', icon: SkipForward },
};

export const StopCard: React.FC<StopCardProps> = ({ stop, isCurrent = false, onCheckIn, onCheckOut, onSkip, onPress }) => {
  const { t } = useTranslation();
  const config = statusConfig[stop.Status as RouteStopStatus] || statusConfig[RouteStopStatus.Pending];

  return (
    <Box className={`mb-2 rounded-xl p-4 shadow-sm ${isCurrent ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}>
      <HStack className="items-start justify-between">
        <HStack className="flex-1 items-start space-x-3">
          <Box className="mt-1 items-center justify-center rounded-full p-1" style={{ backgroundColor: config.color + '20' }}>
            <Icon as={config.icon} size="sm" style={{ color: config.color }} />
          </Box>

          <VStack className="flex-1">
            <HStack className="items-center space-x-2">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">{stop.Name}</Text>
              <Badge size="sm" style={{ backgroundColor: config.color + '20' }}>
                <BadgeText style={{ color: config.color }}>{t(config.labelKey)}</BadgeText>
              </Badge>
            </HStack>

            {stop.Address ? (
              <HStack className="mt-1 items-center space-x-1">
                <Icon as={MapPin} size="xs" className="text-gray-400" />
                <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={1}>
                  {stop.Address}
                </Text>
              </HStack>
            ) : null}

            {stop.ContactId ? (
              <HStack className="mt-1 items-center space-x-1">
                <Icon as={User} size="xs" className="text-gray-400" />
                <Text className="text-sm text-blue-600 dark:text-blue-400">{t('routes.contact')}</Text>
              </HStack>
            ) : null}

            {stop.PlannedArrival ? (
              <HStack className="mt-1 items-center space-x-1">
                <Icon as={Clock} size="xs" className="text-gray-400" />
                <Text className="text-xs text-gray-500 dark:text-gray-500">
                  {t('routes.eta')}: {stop.PlannedArrival}
                </Text>
              </HStack>
            ) : null}
          </VStack>
        </HStack>

        <Text className="text-lg font-bold text-gray-300 dark:text-gray-600">#{stop.StopOrder}</Text>
      </HStack>

      {/* Action buttons for current stop */}
      {isCurrent && stop.Status !== RouteStopStatus.Completed && stop.Status !== RouteStopStatus.Skipped ? (
        <HStack className="mt-3 gap-3">
          {stop.Status === RouteStopStatus.Pending ? (
            <Button size="sm" className="flex-1 bg-blue-500" onPress={onCheckIn}>
              <ButtonText>{t('routes.check_in')}</ButtonText>
            </Button>
          ) : null}

          {stop.Status === RouteStopStatus.InProgress ? (
            <Button size="sm" className="flex-1 bg-green-500" onPress={onCheckOut}>
              <ButtonText>{t('routes.check_out')}</ButtonText>
            </Button>
          ) : null}

          <Button size="sm" variant="outline" className="border-yellow-500" onPress={onSkip}>
            <ButtonText className="text-yellow-600">{t('routes.skip')}</ButtonText>
          </Button>
        </HStack>
      ) : null}
    </Box>
  );
};
