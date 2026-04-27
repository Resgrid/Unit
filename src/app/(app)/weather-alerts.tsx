import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { CloudOff, RefreshCcwDotIcon, Search, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { SeverityFilterTabs } from '@/components/weather-alerts/severity-filter-tabs';
import { WeatherAlertCard } from '@/components/weather-alerts/weather-alert-card';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';
import { useWeatherAlertsStore } from '@/stores/weather-alerts/store';

export default function WeatherAlerts() {
  const alerts = useWeatherAlertsStore((state) => state.alerts);
  const isLoading = useWeatherAlertsStore((state) => state.isLoading);
  const error = useWeatherAlertsStore((state) => state.error);
  const settings = useWeatherAlertsStore((state) => state.settings);
  const severityFilter = useWeatherAlertsStore((state) => state.severityFilter);
  const setSeverityFilter = useWeatherAlertsStore((state) => state.setSeverityFilter);
  const fetchActiveAlerts = useWeatherAlertsStore((state) => state.fetchActiveAlerts);
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchActiveAlerts();
    }, [fetchActiveAlerts])
  );

  const handleRefresh = () => {
    fetchActiveAlerts();
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== null && alert.Severity !== severityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        alert.Event.toLowerCase().includes(query) ||
        alert.Headline.toLowerCase().includes(query) ||
        alert.AreaDescription.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const renderItem = useCallback(
    ({ item }: { item: WeatherAlertResultData }) => (
      <Pressable onPress={() => router.push(`/weather-alert/${item.WeatherAlertId}`)}>
        <WeatherAlertCard alert={item} />
      </Pressable>
    ),
    []
  );

  const keyExtractor = useCallback((item: WeatherAlertResultData) => item.WeatherAlertId, []);

  const renderContent = () => {
    if (settings?.WeatherAlertsEnabled === false) {
      return <ZeroState heading={t('weather_alerts.feature_disabled')} description={t('weather_alerts.feature_disabled_description')} icon={CloudOff} />;
    }

    if (isLoading) {
      return <Loading text={t('weather_alerts.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    return (
      <>
        <SeverityFilterTabs selectedFilter={severityFilter} onFilterChange={setSeverityFilter} alerts={alerts} />
        <FlatList<WeatherAlertResultData>
          testID="weather-alerts-list"
          data={filteredAlerts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <ZeroState heading={t('weather_alerts.no_alerts')} description={t('weather_alerts.no_alerts_description')} icon={RefreshCcwDotIcon} />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          removeClippedSubviews
        />
      </>
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        {/* Search input */}
        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('weather_alerts.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        {/* Main content */}
        <Box className="flex-1">{renderContent()}</Box>
      </Box>
    </View>
  );
}
