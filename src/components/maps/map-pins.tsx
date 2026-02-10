import React, { useCallback } from 'react';

import Mapbox from '@/components/maps/mapbox';
import { type MAP_ICONS } from '@/constants/map-icons';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import PinMarker from './pin-marker';

type MapIconKey = keyof typeof MAP_ICONS;

interface MapPinsProps {
  pins: MapMakerInfoData[];
  onPinPress?: (pin: MapMakerInfoData) => void;
}

// Individual pin wrapper to keep stable onPress callbacks per pin
const MapPin = React.memo(({ pin, onPinPress }: { pin: MapMakerInfoData; onPinPress?: (pin: MapMakerInfoData) => void }) => {
  const handlePress = useCallback(() => {
    onPinPress?.(pin);
  }, [onPinPress, pin]);

  return (
    <Mapbox.MarkerView key={`pin-${pin.Id}`} id={`pin-${pin.Id}`} coordinate={[pin.Longitude, pin.Latitude]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap={true}>
      <PinMarker imagePath={pin.ImagePath as MapIconKey} title={pin.Title} size={32} onPress={handlePress} />
    </Mapbox.MarkerView>
  );
});

MapPin.displayName = 'MapPin';

const MapPins: React.FC<MapPinsProps> = ({ pins, onPinPress }) => {
  return (
    <>
      {pins.map((pin) => (
        <MapPin key={`pin-${pin.Id}`} pin={pin} onPinPress={onPinPress} />
      ))}
    </>
  );
};

export default React.memo(MapPins);
