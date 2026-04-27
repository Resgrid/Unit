import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { getSeverityColor } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';
import { WeatherAlertSeverity } from '@/models/v4/weatherAlerts/weatherAlertEnums';

interface SeverityFilterTabsProps {
  selectedFilter: number | null;
  onFilterChange: (severity: number | null) => void;
  alerts: WeatherAlertResultData[];
}

const FILTERS: Array<{ severity: number | null; labelKey: string }> = [
  { severity: null, labelKey: 'weather_alerts.filter.all' },
  { severity: WeatherAlertSeverity.Extreme, labelKey: 'weather_alerts.severity.extreme' },
  { severity: WeatherAlertSeverity.Severe, labelKey: 'weather_alerts.severity.severe' },
  { severity: WeatherAlertSeverity.Moderate, labelKey: 'weather_alerts.severity.moderate' },
  { severity: WeatherAlertSeverity.Minor, labelKey: 'weather_alerts.severity.minor' },
];

export const SeverityFilterTabs: React.FC<SeverityFilterTabsProps> = ({ selectedFilter, onFilterChange, alerts }) => {
  const { t } = useTranslation();

  const getCount = (severity: number | null): number => {
    if (severity === null) return alerts.length;
    return alerts.filter((a) => a.Severity === severity).length;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
      {FILTERS.map((filter) => {
        const isActive = selectedFilter === filter.severity;
        const count = getCount(filter.severity);
        const chipColor = filter.severity !== null ? getSeverityColor(filter.severity) : '#3b82f6';

        return (
          <Pressable key={String(filter.severity)} onPress={() => onFilterChange(filter.severity)}>
            <Box
              style={isActive ? { backgroundColor: chipColor } : { borderColor: chipColor, borderWidth: 1 }}
              className="mr-2 rounded-full px-3 py-1.5"
            >
              <Text
                style={isActive ? { color: '#FFFFFF' } : { color: chipColor }}
                className="text-xs font-medium"
              >
                {t(filter.labelKey)} ({count})
              </Text>
            </Box>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
