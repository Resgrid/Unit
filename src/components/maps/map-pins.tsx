import Mapbox from '@rnmapbox/maps';
import React from 'react';
import { StyleSheet } from 'react-native';

import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import PinMarker from './pin-marker';

interface MapPinsProps {
  pins: MapMakerInfoData[];
  onPinPress?: (pin: MapMakerInfoData) => void;
}

const MapPins: React.FC<MapPinsProps> = ({ pins, onPinPress }) => {
  return (
    <>
      {pins.map((pin) => (
        <Mapbox.PointAnnotation
          key={pin.Id}
          id={pin.Id}
          coordinate={[pin.Longitude, pin.Latitude]}
          title={pin.Title}
          onSelected={() => onPinPress?.(pin)}
          //style={[styles.pinContainer, { zIndex: parseInt(pin.zIndex || '0') }]}
          style={styles.pinContainer}
        >
          <PinMarker imagePath={pin.ImagePath} title={pin.Title} size={32} />
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
});

export default MapPins;
