import { Image } from 'expo-image';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MAP_ICONS } from '@/constants/map-icons';

type MapIconKey = keyof typeof MAP_ICONS;

interface PinMarkerProps {
  imagePath?: string;
  title: string;
  size?: number;
}

const PinMarker: React.FC<PinMarkerProps> = ({
  imagePath,
  title,
  size = 32,
}) => {
  const { colorScheme } = useColorScheme();

  const iconKey = (imagePath?.toLowerCase() ?? 'person') as MapIconKey;
  const icon = MAP_ICONS[iconKey];

  if (icon && icon.uri) {
    return (
      <View style={styles.container}>
        <Image
          source={icon.uri}
          style={[styles.image, { width: size, height: size }]}
        />
        <Text
          style={[
            styles.title,
            { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>
    );
  } else {
    return (
      <View style={styles.container}>
        <Text>{title}</Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    minWidth: 100,
    maxWidth: 180,
  },
  image: {
    resizeMode: 'contain',
  },
  title: {
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
    color: '#000000',
  },
});

export default PinMarker;
