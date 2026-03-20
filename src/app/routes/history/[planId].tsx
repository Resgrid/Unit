import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Clock, MapPin, Navigation, RefreshCcwDotIcon } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import {
  type RouteInstanceResultData,
  RouteInstanceStatus,
} from '@/models/v4/routes/routeInstanceResultData';
import { useRoutesStore } from '@/stores/routes/store';

const STATUS_COLORS: Record<number, string> = {
  [RouteInstanceStatus.Completed]: '#22c55e',
  [RouteInstanceStatus.Cancelled]: '#ef4444',
  [RouteInstanceStatus.Active]: '#3b82f6',
  [RouteInstanceStatus.Paused]: '#eab308',
  [RouteInstanceStatus.Pending]: '#9ca3af',
};

const STATUS_LABELS: Record<number, string> = {
  [RouteInstanceStatus.Pending]: 'Pending',
  [RouteInstanceStatus.Active]: 'Active',
  [RouteInstanceStatus.Paused]: 'Paused',
  [RouteInstanceStatus.Completed]: 'Completed',
  [RouteInstanceStatus.Cancelled]: 'Cancelled',
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return '--';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function RouteHistory() {
  const { t } = useTranslation();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const routeHistory = useRoutesStore((state) => state.routeHistory);
  const fetchRouteHistory = useRoutesStore((state) => state.fetchRouteHistory);
  const isLoading = useRoutesStore((state) => state.isLoading);
  const error = useRoutesStore((state) => state.error);

  useFocusEffect(
    useCallback(() => {
      if (planId) {
        fetchRouteHistory(planId);
      }
    }, [planId, fetchRouteHistory])
  );

  const handleRefresh = () => {
    if (planId) {
      fetchRouteHistory(planId);
    }
  };

  const handleInstancePress = (instance: RouteInstanceResultData) => {
    router.push(`/routes/history/instance/${instance.RouteInstanceId}`);
  };

  const renderItem = ({ item }: { item: RouteInstanceResultData }) => {
    const statusColor = STATUS_COLORS[item.Status] ?? '#9ca3af';
    const statusLabel = STATUS_LABELS[item.Status] ?? 'Unknown';
    const completedDate = item.CompletedOn || item.CancelledOn || item.StartedOn;

    return (
      <Pressable onPress={() => handleInstancePress(item)}>
        <Box className="mb-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <HStack className="items-start justify-between">
            <VStack className="flex-1 space-y-1">
              {/* Date */}
              <HStack className="items-center space-x-2">
                <Icon as={Clock} size="xs" className="text-gray-500" />
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(completedDate)}
                </Text>
              </HStack>

              {/* Unit Name */}
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {item.UnitName || t('routes.unit')}
              </Text>

              {/* Stats row */}
              <HStack className="mt-2 items-center space-x-4">
                <HStack className="items-center space-x-1">
                  <Icon as={Navigation} size="xs" className="text-gray-500" />
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDistance(item.TotalDistanceMeters)}
                  </Text>
                </HStack>

                <HStack className="items-center space-x-1">
                  <Icon as={Clock} size="xs" className="text-gray-500" />
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDuration(item.TotalDurationSeconds)}
                  </Text>
                </HStack>

                <HStack className="items-center space-x-1">
                  <Icon as={MapPin} size="xs" className="text-gray-500" />
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {item.CurrentStopIndex ?? 0} stops
                  </Text>
                </HStack>
              </HStack>
            </VStack>

            {/* Status badge */}
            <Badge style={{ backgroundColor: statusColor }} className="rounded-full">
              <BadgeText className="text-xs font-semibold text-white">
                {statusLabel}
              </BadgeText>
            </Badge>
          </HStack>

          {/* Progress bar */}
          {item.ProgressPercentage != null && item.ProgressPercentage > 0 && (
            <Box className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <Box
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(item.ProgressPercentage, 100)}%`,
                  backgroundColor: statusColor,
                }}
              />
            </Box>
          )}
        </Box>
      </Pressable>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <Loading text={t('routes.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.error')} description={error} isError={true} />;
    }

    return (
      <FlatList<RouteInstanceResultData>
        testID="route-history-list"
        data={routeHistory}
        renderItem={renderItem}
        keyExtractor={(item: RouteInstanceResultData) => item.RouteInstanceId}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <ZeroState
            heading={t('routes.no_history')}
            description={t('routes.no_history_description')}
            icon={RefreshCcwDotIcon}
          />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <Stack.Screen options={{ title: t('routes.history') }} />
      <Box className="flex-1 px-4 pt-4">{renderContent()}</Box>
    </View>
  );
}
