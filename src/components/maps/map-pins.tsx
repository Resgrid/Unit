import React, { useCallback } from 'react';

import Mapbox from '@/components/maps/mapbox';
import { type MAP_ICONS } from '@/constants/map-icons';
import { isPoiMarker } from '@/lib/poi-marker-utils';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import PinMarker from './pin-marker';
import PoiMarker from './poi-marker';

type MapIconKey = keyof typeof MAP_ICONS;

interface MapPinsProps {
  pins: MapMakerInfoData[];
  onPinPress?: (pin: MapMakerInfoData) => void;
}

/**
 * Individual pin wrapper that renders the appropriate marker component
 * based on whether the marker is a POI or a legacy (call/unit/station/personnel) marker.
 *
 * POI markers use the SVG shape + icon rendering (per the "POI Map Icon Renderer"
 * reference document). Non-POI markers use PNG images from the MAP_ICONS lookup.
 */
const MapPin = React.memo(({ pin, onPinPress }: { pin: MapMakerInfoData; onPinPress?: (pin: MapMakerInfoData) => void }) => {
  const handlePress = useCallback(() => {
    onPinPress?.(pin);
  }, [onPinPress, pin]);

  const poi = isPoiMarker(pin);

  return (
    <Mapbox.MarkerView
      key={`pin-${pin.Id}`}
      id={`pin-${pin.Id}`}
      coordinate={[pin.Longitude, pin.Latitude]}
      // POI markers: anchor at bottom-center (tip of pin shape)
      // Non-POI markers: anchor at center
      anchor={poi ? { x: 0.5, y: 1.0 } : { x: 0.5, y: 0.5 }}
      allowOverlap={true}
    >
      {poi ? (
        <PoiMarker poiImage={pin.PoiImage} imagePath={pin.ImagePath} color={pin.Color} marker={pin.Marker} title={pin.Title} size={36} onPress={handlePress} />
      ) : (
        <PinMarker imagePath={pin.ImagePath as MapIconKey} poiImage={pin.PoiImage as MapIconKey} title={pin.Title} size={32} onPress={handlePress} />
      )}
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
