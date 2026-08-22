import React, { useCallback, useMemo } from 'react';

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
  /** Id of the department's active call — its pin is highlighted and drawn above the others. */
  activeCallId?: string | null;
}

/** Call markers come back with Type 0 (or the legacy 'call' image). */
function isCallPin(pin: MapMakerInfoData): boolean {
  return pin.Type === 0 || pin.ImagePath?.toLowerCase() === 'call';
}

/**
 * Individual pin wrapper that renders the appropriate marker component
 * based on whether the marker is a POI or a legacy (call/unit/station/personnel) marker.
 *
 * POI markers use the SVG shape + icon rendering (per the "POI Map Icon Renderer"
 * reference document). Non-POI markers use PNG images from the MAP_ICONS lookup.
 */
const MapPin = React.memo(({ pin, onPinPress, isActiveCall }: { pin: MapMakerInfoData; onPinPress?: (pin: MapMakerInfoData) => void; isActiveCall?: boolean }) => {
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
        <PinMarker imagePath={pin.ImagePath as MapIconKey} poiImage={pin.PoiImage as MapIconKey} title={pin.Title} size={isActiveCall ? 40 : 32} isActive={isActiveCall} onPress={handlePress} />
      )}
    </Mapbox.MarkerView>
  );
});

MapPin.displayName = 'MapPin';

const MapPins: React.FC<MapPinsProps> = ({ pins, onPinPress, activeCallId }) => {
  // Markers stack in mount order on every platform (native views and DOM
  // markers alike), so rendering the active call last keeps it on top of
  // overlapping pins.
  const orderedPins = useMemo(() => {
    if (!activeCallId) return pins;
    const activeIndex = pins.findIndex((pin) => isCallPin(pin) && pin.Id === activeCallId);
    if (activeIndex === -1) return pins;
    return [...pins.slice(0, activeIndex), ...pins.slice(activeIndex + 1), pins[activeIndex]];
  }, [pins, activeCallId]);

  return (
    <>
      {orderedPins.map((pin) => {
        const isActiveCall = activeCallId != null && isCallPin(pin) && pin.Id === activeCallId;
        // Stacking order is fixed when the marker attaches (DOM insertion order
        // on web, imperative MarkerView attach on iOS), so reordering keyed
        // children alone updates the ring but never restacks. Folding the active
        // flag into the key remounts the pin whose active state changed, which
        // re-attaches it on top.
        return <MapPin key={`pin-${pin.Id}-${isActiveCall ? 'active' : 'n'}`} pin={pin} onPinPress={onPinPress} isActiveCall={isActiveCall} />;
      })}
    </>
  );
};

export default React.memo(MapPins);
