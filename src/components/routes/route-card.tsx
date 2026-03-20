import { Clock, MapPin, Navigation, Truck } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type RoutePlanResultData } from '@/models/v4/routes/routePlanResultData';

interface RouteCardProps {
  route: RoutePlanResultData;
  isActive?: boolean;
  unitName?: string;
  isMyUnit?: boolean;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  isActive = false,
  unitName,
  isMyUnit = false,
}) => {
  const { t } = useTranslation();

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const bgClass = isMyUnit
    ? 'mb-2 rounded-xl bg-blue-50 p-4 shadow-sm dark:bg-blue-900/20'
    : 'mb-2 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800';

  const borderColor = isMyUnit ? '#3b82f6' : (route.RouteColor || '#94a3b8');

  return (
    <Box
      className={bgClass}
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      <HStack className="items-start justify-between">
        <VStack className="flex-1">
          <HStack className="items-center gap-2">
            <Icon as={Navigation} size="sm" className="text-gray-500 dark:text-gray-400" />
            <Text className="text-lg font-bold text-gray-900 dark:text-white">{route.Name}</Text>
          </HStack>

          {route.Description ? (
            <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400" numberOfLines={2}>
              {route.Description}
            </Text>
          ) : null}

          {/* Unit assignment chip */}
          <HStack className="mt-2 items-center gap-1.5">
            <Icon as={Truck} size="xs" className={isMyUnit ? 'text-blue-500' : 'text-gray-400'} />
            <Text className={`text-xs font-medium ${isMyUnit ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {unitName || t('routes.unassigned')}
            </Text>
          </HStack>

          <HStack className="mt-2 gap-4">
            <HStack className="items-center gap-1.5">
              <Icon as={MapPin} size="xs" className="text-gray-400" />
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {t('routes.stop_count', { count: route.StopsCount ?? 0 })}
              </Text>
            </HStack>

            {(route.EstimatedDistanceMeters ?? 0) > 0 ? (
              <HStack className="items-center gap-1.5">
                <Icon as={Navigation} size="xs" className="text-gray-400" />
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDistance(route.EstimatedDistanceMeters!)}
                </Text>
              </HStack>
            ) : null}

            {(route.EstimatedDurationSeconds ?? 0) > 0 ? (
              <HStack className="items-center gap-1.5">
                <Icon as={Clock} size="xs" className="text-gray-400" />
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDuration(route.EstimatedDurationSeconds!)}
                </Text>
              </HStack>
            ) : null}
          </HStack>
        </VStack>

        <VStack className="items-end space-y-1">
          {isActive ? (
            <Badge className="bg-green-500">
              <BadgeText className="text-white">{t('routes.active')}</BadgeText>
            </Badge>
          ) : null}
          {isMyUnit && !isActive ? (
            <Badge className="bg-blue-500">
              <BadgeText className="text-white">{t('routes.my_unit')}</BadgeText>
            </Badge>
          ) : null}
        </VStack>
      </HStack>

      {route.ScheduleInfo ? (
        <HStack className="mt-2 items-center gap-1.5">
          <Icon as={Clock} size="xs" className="text-blue-500" />
          <Text className="text-xs text-blue-600 dark:text-blue-400">{route.ScheduleInfo}</Text>
        </HStack>
      ) : null}
    </Box>
  );
};
