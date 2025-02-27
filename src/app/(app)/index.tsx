import Mapbox from '@rnmapbox/maps';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, View } from 'react-native';

import { Env } from '@/lib/env';
import { onSortOptions } from '@/lib/utils';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

export default function Map() {
  const { t } = useTranslation();
  const _mapOptions = Object.keys(Mapbox.StyleURL)
    .map((key) => {
      return {
        label: key,
        data: (Mapbox.StyleURL as any)[key], // bad any, because enums
      };
    })
    .sort(onSortOptions);

  const [styleURL, setStyleURL] = useState({ styleURL: _mapOptions[0].data });

  useEffect(() => {
    Mapbox.locationManager.start();

    return (): void => {
      Mapbox.locationManager.stop();
    };
  }, []);

  const onMapChange = (index: number, newStyleURL: Mapbox.StyleURL): void => {
    setStyleURL({ styleURL: newStyleURL });
  };

  const onUserMarkerPress = (): void => {
    Alert.alert('You pressed on the user location annotation');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('tabs.map'), // This will show in the tab bar
          headerTitle: t('app.title'), // This will show in the header
          headerShown: true,
        }}
      />
      <View className="size-full flex-1">
        <Mapbox.MapView
          //styleURL={styleURL.styleURL}
          style={styles.map}
        >
          <Mapbox.Camera followZoomLevel={12} followUserLocation />

          <Mapbox.UserLocation onPress={onUserMarkerPress} />
        </Mapbox.MapView>
      </View>
    </>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
};
