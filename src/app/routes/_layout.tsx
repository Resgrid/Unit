import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function RoutesLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="index" options={{ title: t('routes.title') }} />
      <Stack.Screen name="start" options={{ title: t('routes.view_route') }} />
      <Stack.Screen name="active" options={{ title: t('routes.active_route') }} />
      <Stack.Screen name="directions" options={{ title: t('routes.directions') }} />
      <Stack.Screen name="poi/[id]" options={{ title: t('routes.poi_detail') }} />
      <Stack.Screen name="stop/[id]" options={{ title: t('routes.stop_detail') }} />
      <Stack.Screen name="stop/contact" options={{ title: t('routes.stop_contact') }} />
      <Stack.Screen name="history/[planId]" options={{ title: t('routes.history') }} />
      <Stack.Screen name="history/instance/[id]" options={{ title: t('routes.instance_detail') }} />
    </Stack>
  );
}
