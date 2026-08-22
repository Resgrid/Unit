import {
  AlertCircle as RawAlertCircle,
  AlertTriangle as RawAlertTriangle,
  ArrowLeft as RawArrowLeft,
  Bell as RawBell,
  BluetoothIcon as RawBluetoothIcon,
  Box as RawBox,
  BuildingIcon as RawBuildingIcon,
  Calendar as RawCalendar,
  CalendarIcon as RawCalendarIcon,
  Check as RawCheck,
  CheckCircle as RawCheckCircle,
  CheckIcon as RawCheckIcon,
  ChevronDownIcon as RawChevronDownIcon,
  ChevronLeft as RawChevronLeft,
  ChevronRight as RawChevronRight,
  ChevronRightIcon as RawChevronRightIcon,
  CloudAlert as RawCloudAlert,
  Contact as RawContact,
  Edit2Icon as RawEdit2Icon,
  EyeIcon as RawEyeIcon,
  EyeOffIcon as RawEyeOffIcon,
  Globe as RawGlobe,
  GlobeIcon as RawGlobeIcon,
  Headphones as RawHeadphones,
  HomeIcon as RawHomeIcon,
  ListTree as RawListTree,
  Loader2 as RawLoader2,
  type LucideProps,
  MailIcon as RawMailIcon,
  Map as RawMap,
  MapPinIcon as RawMapPinIcon,
  Megaphone as RawMegaphone,
  Menu as RawMenu,
  MessageCircle as RawMessageCircle,
  Mic as RawMic,
  Navigation as RawNavigation,
  Notebook as RawNotebook,
  Phone as RawPhone,
  PhoneIcon as RawPhoneIcon,
  PlusIcon as RawPlusIcon,
  RefreshCwIcon as RawRefreshCwIcon,
  SearchIcon as RawSearchIcon,
  Settings as RawSettings,
  SettingsIcon as RawSettingsIcon,
  ShieldCheck as RawShieldCheck,
  SmartphoneIcon as RawSmartphoneIcon,
  Speaker as RawSpeaker,
  StarIcon as RawStarIcon,
  Tag as RawTag,
  TrashIcon as RawTrashIcon,
  UserIcon as RawUserIcon,
  Users as RawUsers,
  UsersIcon as RawUsersIcon,
  WifiIcon as RawWifiIcon,
  X as RawX,
} from 'lucide-react-native';
import { styled } from 'nativewind';
import type React from 'react';

/**
 * lucide icons that understand `className`.
 *
 * nativewind v5 dropped the JSX transform: a `className` only has an effect on a component
 * that has been through `styled()`, and metro's polyfill only covers `react-native` itself.
 * On a raw lucide icon the class was silently discarded -- which is why `text-*` colours and
 * `mr-*` spacing had no effect and icons rendered with their default near-black stroke.
 *
 * `target: 'style'` keeps layout utilities working, and `nativeStyleMapping` lifts the
 * resolved colour out of the style object onto lucide's `color` prop, which is where
 * react-native-svg resolves `currentColor` from.
 *
 * Only icons used with a className live here, so the bundle is unchanged; import the rest
 * straight from `lucide-react-native`.
 */
const iconMapping = {
  className: {
    target: 'style',
    nativeStyleMapping: {
      color: 'color',
    },
  },
} as const;

type LucideIcon = React.ComponentType<LucideProps>;

const themed = <T extends LucideIcon>(Component: T): T => styled(Component as LucideIcon, iconMapping) as unknown as T;

export const AlertCircle = themed(RawAlertCircle);
export const AlertTriangle = themed(RawAlertTriangle);
export const ArrowLeft = themed(RawArrowLeft);
export const Bell = themed(RawBell);
export const BluetoothIcon = themed(RawBluetoothIcon);
export const Box = themed(RawBox);
export const BuildingIcon = themed(RawBuildingIcon);
export const Calendar = themed(RawCalendar);
export const CalendarIcon = themed(RawCalendarIcon);
export const Check = themed(RawCheck);
export const CheckCircle = themed(RawCheckCircle);
export const CheckIcon = themed(RawCheckIcon);
export const ChevronDownIcon = themed(RawChevronDownIcon);
export const ChevronLeft = themed(RawChevronLeft);
export const ChevronRight = themed(RawChevronRight);
export const ChevronRightIcon = themed(RawChevronRightIcon);
export const CloudAlert = themed(RawCloudAlert);
export const Contact = themed(RawContact);
export const Edit2Icon = themed(RawEdit2Icon);
export const EyeIcon = themed(RawEyeIcon);
export const EyeOffIcon = themed(RawEyeOffIcon);
export const Globe = themed(RawGlobe);
export const GlobeIcon = themed(RawGlobeIcon);
export const Headphones = themed(RawHeadphones);
export const HomeIcon = themed(RawHomeIcon);
export const ListTree = themed(RawListTree);
export const Loader2 = themed(RawLoader2);
export const MailIcon = themed(RawMailIcon);
export const Map = themed(RawMap);
export const MapPinIcon = themed(RawMapPinIcon);
export const Megaphone = themed(RawMegaphone);
export const Menu = themed(RawMenu);
export const MessageCircle = themed(RawMessageCircle);
export const Mic = themed(RawMic);
export const Navigation = themed(RawNavigation);
export const Notebook = themed(RawNotebook);
export const Phone = themed(RawPhone);
export const PhoneIcon = themed(RawPhoneIcon);
export const PlusIcon = themed(RawPlusIcon);
export const RefreshCwIcon = themed(RawRefreshCwIcon);
export const SearchIcon = themed(RawSearchIcon);
export const Settings = themed(RawSettings);
export const SettingsIcon = themed(RawSettingsIcon);
export const ShieldCheck = themed(RawShieldCheck);
export const SmartphoneIcon = themed(RawSmartphoneIcon);
export const Speaker = themed(RawSpeaker);
export const StarIcon = themed(RawStarIcon);
export const Tag = themed(RawTag);
export const TrashIcon = themed(RawTrashIcon);
export const UserIcon = themed(RawUserIcon);
export const Users = themed(RawUsers);
export const UsersIcon = themed(RawUsersIcon);
export const WifiIcon = themed(RawWifiIcon);
export const X = themed(RawX);
