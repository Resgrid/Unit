import {
  AlertTriangle,
  Anchor,
  Banknote,
  BedSingle,
  Beer,
  Bird,
  BookOpen,
  Building2,
  Bus,
  BusFront,
  Car,
  Church,
  Circle,
  Cog,
  Cross,
  Factory,
  Flag,
  Flame,
  Fuel,
  Globe,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Hotel,
  Landmark,
  LibraryBig,
  type LucideIcon,
  MapPin,
  Mountain,
  ParkingCircle,
  Pill,
  Plane,
  RailSymbol,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Siren,
  Square,
  Stamp,
  Store,
  TentTree,
  Theater,
  TrainFront,
  Trees,
  TriangleAlert,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react-native';
import React from 'react';

import { POI_ICON_LAYOUT } from '@/lib/poi-marker-utils';

/**
 * Maps a map-icon key name (e.g., "hospital") to a lucide-react-native icon component.
 * Covers the most commonly used POI type icons from the map-icons font library.
 * Unmapped icons fall back to a simple white circle.
 */
const MAP_ICON_TO_LUCIDE: Record<string, LucideIcon> = {
  // Medical / Emergency
  hospital: HeartPulse,
  'first-aid': Cross,
  pharmacy: Pill,
  'medical-store': Pill,
  'medical-shop': Pill,

  // Fire / Police / Emergency Services
  'fire-station': Flame,
  police: Siren,
  'police-station': Siren,
  'emergency-phone': TriangleAlert,
  ambulance: Truck,

  // Transportation
  airport: Plane,
  'bus-station': Bus,
  'train-station': TrainFront,
  'rail-station': RailSymbol,
  parking: ParkingCircle,
  'parking-garage': ParkingCircle,
  'gas-station': Fuel,
  'car-rental': Car,
  'ferry-terminal': Anchor,
  heliport: Plane,

  // Education
  school: GraduationCap,
  university: Building2,
  library: LibraryBig,
  museum: Landmark,

  // Government / Civic
  courthouse: Landmark,
  'city-hall': Building2,
  embassy: Flag,
  'post-office': Stamp,

  // Religious
  church: Church,
  mosque: Building2,
  synagogue: Building2,
  temple: Building2,
  'place-of-worship': Church,

  // Commercial
  bank: Banknote,
  restaurant: UtensilsCrossed,
  cafe: UtensilsCrossed,
  bar: Beer,
  store: Store,
  'grocery-or-supermarket': ShoppingCart,
  'shopping-mall': ShoppingBag,
  'clothing-store': ShoppingBasket,
  'convenience-store': Store,
  'hardware-store': Wrench,
  bakery: UtensilsCrossed,
  'liquor-store': Beer,

  // Recreation / Entertainment
  park: Trees,
  playground: Trees,
  campground: TentTree,
  stadium: Flag,
  theater: Theater,
  cinema: Theater,
  zoo: Bird,
  aquarium: Waves,
  'golf-course': Flag,
  gym: Cog,
  spa: HeartPulse,
  'night-club': Beer,

  // Accommodation
  lodging: Hotel,
  hotel: Hotel,
  motel: Hotel,

  // Industrial / Work
  'industrial-building': Factory,
  industry: Factory,
  factory: Factory,
  warehouse: Warehouse,
  'construction-site': Hammer,
  workshop: Wrench,

  // Natural Features
  mountain: Mountain,
  volcano: TriangleAlert,
  waterfall: Waves,
  beach: Waves,
  river: Waves,
  lake: Waves,

  // Infrastructure
  bridge: Anchor,
  dam: Waves,
  lighthouse: Globe,
  'power-plant': Zap,
  'water-supply': Waves,

  // Shape-type icons (used as POI type icons themselves)
  'map-pin': MapPin,
  'point-of-interest': MapPin,
  shield: Shield,
  route: MapPin,
  square: Square,
  'square-rounded': Square,
  'square-pin': Square,
};

/**
 * Props for the PoiMarkerIcon component.
 */
interface PoiMarkerIconProps {
  /** The map-icon key (e.g., "hospital" from "map-icon-hospital") */
  iconKey: string;
  /** Font size in pixels */
  size: number;
}

/**
 * Renders the inner icon for a POI marker.
 *
 * Maps map-icon CSS class keys to lucide-react-native vector icons.
 * Falls back to a simple white circle when no mapping exists.
 * All icons are rendered in white (#ffffff) to match the web app rendering.
 */
const PoiMarkerIcon: React.FC<PoiMarkerIconProps> = React.memo(({ iconKey, size }) => {
  const IconComponent = iconKey ? MAP_ICON_TO_LUCIDE[iconKey] : undefined;

  if (IconComponent) {
    return <IconComponent size={size} color={POI_ICON_LAYOUT.color} strokeWidth={2} />;
  }

  // Fallback: simple white circle (generic POI indicator)
  return <Circle size={size * 0.65} color={POI_ICON_LAYOUT.color} />;
});

PoiMarkerIcon.displayName = 'PoiMarkerIcon';

/**
 * Returns whether a given map-icon key has a mapped lucide icon.
 * Useful for components that need to know if a specific icon is available.
 */
export function hasLucideIcon(iconKey: string): boolean {
  return iconKey in MAP_ICON_TO_LUCIDE;
}

/**
 * Returns the lucide icon component for a map-icon key, or undefined.
 */
export function getLucideIcon(iconKey: string): LucideIcon | undefined {
  return MAP_ICON_TO_LUCIDE[iconKey];
}

export default PoiMarkerIcon;
