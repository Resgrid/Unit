import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { WeatherAlertDetailMap } from '@/components/weather-alerts/weather-alert-detail-map';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getCategoryIcon, getSeverityColor, getSeverityTranslationKey } from '@/lib/weather-alert-utils';
import { useWeatherAlertsStore } from '@/stores/weather-alerts/store';

export default function WeatherAlertDetail() {
  const { id } = useLocalSearchParams();
  const alertId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { colorScheme } = useColorScheme();

  const alert = useWeatherAlertsStore((state) => state.selectedAlert);
  const isLoading = useWeatherAlertsStore((state) => state.isLoadingDetail);
  const fetchAlertDetail = useWeatherAlertsStore((state) => state.fetchAlertDetail);

  useEffect(() => {
    if (alertId) {
      fetchAlertDetail(alertId);
    }
  }, [alertId, fetchAlertDetail]);

  const severityColor = useMemo(() => (alert ? getSeverityColor(alert.Severity) : '#9E9E9E'), [alert]);
  const CategoryIcon = useMemo(() => (alert ? getCategoryIcon(alert.Category) : null), [alert]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return t('call_detail.not_available');
    try {
      return format(new Date(dateStr), 'PPp');
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('weather_alerts.title'), headerShown: true }} />
        <Loading text={t('weather_alerts.loading')} />
      </>
    );
  }

  if (!alert) {
    return (
      <>
        <Stack.Screen options={{ title: t('weather_alerts.title'), headerShown: true }} />
        <ZeroState heading={t('weather_alerts.no_alerts')} description="" />
      </>
    );
  }

  const mapSection = (
    <Box className="mb-4">
      <WeatherAlertDetailMap alert={alert} />
    </Box>
  );

  const detailSection = (
    <VStack space="md">
      {/* Header */}
      <HStack className="items-center" space="sm">
        {CategoryIcon ? <CategoryIcon size={24} color={severityColor} /> : null}
        <VStack className="flex-1">
          <Heading size="lg" className="text-gray-900 dark:text-gray-100">
            {alert.Event}
          </Heading>
          <Box style={{ backgroundColor: severityColor, alignSelf: 'flex-start' }} className="mt-1 rounded-md px-2 py-0.5">
            <Text className="text-xs font-bold text-white">{t(getSeverityTranslationKey(alert.Severity))}</Text>
          </Box>
        </VStack>
      </HStack>

      {/* Timing */}
      <Box className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
        <VStack space="sm">
          {alert.EffectiveUtc ? (
            <HStack className="justify-between">
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.effective')}</Text>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(alert.EffectiveUtc)}</Text>
            </HStack>
          ) : null}
          {alert.OnsetUtc ? (
            <HStack className="justify-between">
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.onset')}</Text>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(alert.OnsetUtc)}</Text>
            </HStack>
          ) : null}
          {alert.ExpiresUtc ? (
            <HStack className="justify-between">
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.expires')}</Text>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(alert.ExpiresUtc)}</Text>
            </HStack>
          ) : null}
        </VStack>
      </Box>

      {/* Headline */}
      {alert.Headline ? (
        <VStack>
          <Text className="mb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.headline')}</Text>
          <Text className="text-base text-gray-900 dark:text-gray-100">{alert.Headline}</Text>
        </VStack>
      ) : null}

      {/* Description */}
      {alert.Description ? (
        <VStack>
          <Text className="mb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.description')}</Text>
          <Text className="text-sm text-gray-700 dark:text-gray-300">{alert.Description}</Text>
        </VStack>
      ) : null}

      {/* Instructions */}
      {alert.Instructions ? (
        <Box style={{ borderLeftWidth: 3, borderLeftColor: severityColor }} className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
          <Text className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">{t('weather_alerts.detail.instructions')}</Text>
          <Text className="text-sm text-gray-700 dark:text-gray-300">{alert.Instructions}</Text>
        </Box>
      ) : null}

      {/* Affected Area */}
      {alert.AreaDescription ? (
        <VStack>
          <Text className="mb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.area')}</Text>
          <Text className="text-sm text-gray-700 dark:text-gray-300">{alert.AreaDescription}</Text>
        </VStack>
      ) : null}

      {/* Metadata */}
      <Box className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
        <VStack space="sm">
          {alert.SenderName ? (
            <HStack className="justify-between">
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.sender')}</Text>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{alert.SenderName}</Text>
            </HStack>
          ) : null}
          <HStack className="justify-between">
            <Text className="text-sm text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.urgency')}</Text>
            <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{t(`weather_alerts.urgency.${['immediate', 'expected', 'future', 'past', 'unknown'][alert.Urgency] ?? 'unknown'}`)}</Text>
          </HStack>
          <HStack className="justify-between">
            <Text className="text-sm text-gray-500 dark:text-gray-400">{t('weather_alerts.detail.certainty')}</Text>
            <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{t(`weather_alerts.certainty.${['observed', 'likely', 'possible', 'unlikely', 'unknown'][alert.Certainty] ?? 'unknown'}`)}</Text>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: alert.Event,
          headerShown: true,
          headerBackTitle: t('common.back'),
        }}
      />
      <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <FocusAwareStatusBar />
        {isLandscape ? (
          <View className="flex-1 flex-row p-4">
            <View className="mr-4 flex-1">{mapSection}</View>
            <ScrollView className="flex-1">{detailSection}</ScrollView>
          </View>
        ) : (
          <ScrollView className="flex-1 p-4">
            {mapSection}
            {detailSection}
          </ScrollView>
        )}
      </View>
    </>
  );
}
