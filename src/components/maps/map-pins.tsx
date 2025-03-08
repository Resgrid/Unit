import Mapbox from '@rnmapbox/maps';
import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';

import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import PinMarker from './pin-marker';

interface MapPinsProps {
  pins: MapMakerInfoData[];
  onPinPress?: (pin: MapMakerInfoData) => void;
}

const MapPins: React.FC<MapPinsProps> = ({ pins, onPinPress }) => {
  const markerRefs = useRef<{ [key: string]: Mapbox.PointAnnotation | null }>({});

  return (
    <>
      {pins.map((pin) => (
        <Mapbox.PointAnnotation
          ref={(ref) => {
            if (markerRefs.current) {
              markerRefs.current[pin.Id] = ref;
            }
          }}
          key={`pin-${pin.Id}`}
          id={`pin-${pin.Id}`}
          coordinate={[pin.Longitude, pin.Latitude]}
          //title={pin.Title}
          //onSelected={() => onPinPress?.(pin)}
          //style={[styles.pinContainer, { zIndex: parseInt(pin.zIndex || '0') }]}
          style={styles.pinContainer}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <PinMarker imagePath={pin.ImagePath} title={pin.Title} size={32} markerRef={markerRefs.current[pin.Id]} />
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
