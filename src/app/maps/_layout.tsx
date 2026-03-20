import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function MapsLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="index" options={{ title: t('maps.title') }} />
      <Stack.Screen name="search" options={{ title: t('maps.search_maps'), presentation: 'modal' }} />
      <Stack.Screen name="custom/[id]" options={{ title: t('maps.custom_maps') }} />
      <Stack.Screen name="indoor/[id]" options={{ title: t('maps.indoor_maps') }} />
    </Stack>
  );
}
