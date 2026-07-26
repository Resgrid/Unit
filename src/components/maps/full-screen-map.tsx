import { MapPinIcon, XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Mapbox from '@/components/maps/mapbox';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';
import { Env } from '@/lib/env';

Mapbox.setAccessToken(Env.UNIT_MAPBOX_PUBKEY);

interface FullScreenMapProps {
  isOpen: boolean;
  latitude: number;
  longitude: number;
  onClose: () => void;
  title?: string;
  address?: string;
}

export const FullScreenMap: React.FC<FullScreenMapProps> = ({ isOpen, latitude, longitude, onClose, title, address }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const markerTitle = title || t('call_detail.call_location');
  const coordinate: [number, number] = [longitude, latitude];

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container} testID="full-screen-call-map">
        <Mapbox.MapView
          style={styles.map}
          styleURL={colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
          logoEnabled={false}
          attributionEnabled
          compassEnabled
          zoomEnabled
          rotateEnabled
          scrollEnabled
          pitchEnabled
        >
          <Mapbox.Camera zoomLevel={15} centerCoordinate={coordinate} animationMode="none" animationDuration={0} />
          <Mapbox.PointAnnotation id="call-location" coordinate={coordinate} title={markerTitle}>
            <View style={styles.marker}>
              <MapPinIcon size={42} color={colors.light.danger[600]} />
            </View>
          </Mapbox.PointAnnotation>
        </Mapbox.MapView>

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text className="flex-1 text-lg font-semibold text-white" numberOfLines={1}>
            {markerTitle}
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={12} style={styles.closeButton} testID="full-screen-call-map-close">
            <XIcon size={26} color={colors.dark.text} />
          </TouchableOpacity>
        </View>

        {address ? (
          <View style={[styles.addressContainer, { bottom: insets.bottom + 16 }]}>
            <Text className="text-sm text-white">{address}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
