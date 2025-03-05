import Mapbox from '@rnmapbox/maps';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  imagePath: string;
  zIndex?: number;
}

interface MapPinsProps {
  pins: MapPin[];
  onPinPress?: (pin: MapPin) => void;
}

const MapPins: React.FC<MapPinsProps> = ({ pins, onPinPress }) => {
  return (
    <>
      {pins.map((pin) => (
        <Mapbox.PointAnnotation
          key={pin.id}
          id={pin.id}
          coordinate={[pin.longitude, pin.latitude]}
          title={pin.title}
          onSelected={() => onPinPress?.(pin)}
          style={[styles.pinContainer, { zIndex: pin.zIndex || 0 }]}
        >
          <View style={styles.pinContent} />
        </Mapbox.PointAnnotation>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinContent: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
  },
});

export default MapPins;
