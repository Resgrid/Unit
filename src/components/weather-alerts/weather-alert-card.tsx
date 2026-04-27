import { Clock } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getTimeAgoUtc } from '@/lib/utils';
import { getCategoryIcon, getSeverityColor, getSeverityTranslationKey } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

interface WeatherAlertCardProps {
  alert: WeatherAlertResultData;
}

const WeatherAlertCardComponent: React.FC<WeatherAlertCardProps> = ({ alert }) => {
  const { t } = useTranslation();
  const severityColor = getSeverityColor(alert.Severity);
  const CategoryIcon = getCategoryIcon(alert.Category);

  return (
    <Box style={{ borderLeftWidth: 4, borderLeftColor: severityColor }} className="mb-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
      {/* Header */}
      <HStack className="mb-2 items-center justify-between">
        <HStack className="flex-1 items-center" space="sm">
          <CategoryIcon size={18} color={severityColor} />
          <Box style={{ backgroundColor: severityColor }} className="rounded-md px-2 py-0.5">
            <Text className="text-xs font-bold text-white">{t(getSeverityTranslationKey(alert.Severity))}</Text>
          </Box>
        </HStack>
        <HStack className="items-center" space="xs">
          <Clock size={12} color="#9CA3AF" />
          <Text className="text-xs text-gray-500 dark:text-gray-400">{getTimeAgoUtc(alert.EffectiveUtc)}</Text>
        </HStack>
      </HStack>

      {/* Event name */}
      <Text className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">{alert.Event}</Text>

      {/* Headline */}
      {alert.Headline ? (
        <Text className="mb-2 text-sm text-gray-700 dark:text-gray-300" numberOfLines={2}>
          {alert.Headline}
        </Text>
      ) : null}

      {/* Area */}
      {alert.AreaDescription ? (
        <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {alert.AreaDescription}
        </Text>
      ) : null}

      {/* Expiry */}
      {alert.ExpiresUtc ? (
        <HStack className="mt-2 items-center" space="xs">
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            {t('weather_alerts.detail.expires')}: {new Date(alert.ExpiresUtc).toLocaleString()}
          </Text>
        </HStack>
      ) : null}
    </Box>
  );
};

export const WeatherAlertCard = React.memo(WeatherAlertCardComponent);
