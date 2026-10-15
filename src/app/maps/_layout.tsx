import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { TermKeys, useTerm } from '@/stores/terminology/store';

export default function MapsLayout() {
  const { t } = useTranslation();
  const mapsTitle = useTerm(TermKeys.Mapping, t('maps.title'));

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="index" options={{ title: mapsTitle }} />
      <Stack.Screen name="search" options={{ title: t('maps.search_maps'), presentation: 'modal' }} />
      <Stack.Screen name="custom/[id]" options={{ title: t('maps.custom_maps') }} />
      <Stack.Screen name="indoor/[id]" options={{ title: t('maps.indoor_maps') }} />
    </Stack>
  );
}
