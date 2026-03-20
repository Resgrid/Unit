import { Stack, useLocalSearchParams } from 'expo-router';
import { BuildingIcon, ExternalLinkIcon, MapPinIcon, PhoneIcon, UserIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { getStopContact } from '@/api/routes/routes';
import { Loading } from '@/components/common/loading';
import { Camera, MapView, PointAnnotation, StyleURL } from '@/components/maps/mapbox';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { ContactResultData } from '@/models/v4/contacts/contactResultData';

/**
 * Parse a GPS coordinate string like "lat,lon" into { lat, lon }.
 */
const parseGps = (coords?: string): { lat: number; lon: number } | null => {
  if (!coords) return null;
  const parts = coords.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lon = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
};

const openInMaps = (lat: number, lon: number, label: string) => {
  const url = Platform.select({
    ios: `maps://app?daddr=${lat},${lon}&q=${encodeURIComponent(label)}`,
    android: `google.navigation:q=${lat},${lon}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
  });
  if (url) Linking.openURL(url);
};

const callPhone = (number: string) => {
  const cleaned = number.replace(/[^\d+]/g, '');
  Linking.openURL(`tel:${cleaned}`);
};

interface PhoneRowProps {
  label: string;
  number: string | null | undefined;
  colorScheme: string;
}

function PhoneRow({ label, number, colorScheme }: PhoneRowProps) {
  if (!number) return null;
  return (
    <Pressable onPress={() => callPhone(number)}>
      <HStack className={`items-center border-b px-4 py-3 ${colorScheme === 'dark' ? 'border-neutral-700' : 'border-neutral-200'}`}>
        <Box className="mr-3">
          <PhoneIcon size={18} color="#3b82f6" />
        </Box>
        <VStack className="flex-1">
          <Text className="text-xs text-typography-500">{label}</Text>
          <Text className="text-sm font-medium text-primary-600">{number}</Text>
        </VStack>
        <ExternalLinkIcon size={14} color="#9ca3af" />
      </HStack>
    </Pressable>
  );
}

export default function StopContactScreen() {
  const { t } = useTranslation();
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const { colorScheme } = useColorScheme();

  const [contact, setContact] = useState<ContactResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stopId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getStopContact(stopId)
      .then((result) => {
        if (!cancelled) {
          setContact(result.Data ?? null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(t('common.errorOccurred'));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stopId, t]);

  const locationGps = useMemo(() => parseGps(contact?.LocationGpsCoordinates), [contact]);
  const entranceGps = useMemo(() => parseGps(contact?.EntranceGpsCoordinates), [contact]);
  const exitGps = useMemo(() => parseGps(contact?.ExitGpsCoordinates), [contact]);

  // Determine map center from available coordinates
  const mapCenter = useMemo(() => {
    if (locationGps) return [locationGps.lon, locationGps.lat] as [number, number];
    if (entranceGps) return [entranceGps.lon, entranceGps.lat] as [number, number];
    if (exitGps) return [exitGps.lon, exitGps.lat] as [number, number];
    return null;
  }, [locationGps, entranceGps, exitGps]);

  const displayName = useMemo(() => {
    if (!contact) return '';
    if (contact.CompanyName) return contact.CompanyName;
    const parts = [contact.FirstName, contact.MiddleName, contact.LastName].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    return contact.Name ?? t('routes.no_contact');
  }, [contact, t]);

  const fullAddress = useMemo(() => {
    if (!contact) return null;
    const parts = [contact.Address, contact.City, contact.State, contact.Zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [contact]);

  const handleAddressPress = useCallback(() => {
    const coords = locationGps ?? entranceGps ?? exitGps;
    if (coords) {
      openInMaps(coords.lat, coords.lon, displayName);
    }
  }, [locationGps, entranceGps, exitGps, displayName]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('routes.contact'), headerShown: true, headerBackTitle: '' }} />
        <View className="size-full flex-1">
          <Loading />
        </View>
      </>
    );
  }

  if (error || !contact) {
    return (
      <>
        <Stack.Screen options={{ title: t('routes.contact'), headerShown: true, headerBackTitle: '' }} />
        <Box className="flex-1 items-center justify-center p-4">
          <UserIcon size={48} color="#9ca3af" />
          <Text className="mt-4 text-center text-typography-500">{error ?? t('routes.no_contact')}</Text>
        </Box>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: displayName,
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <ScrollView className={`flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
        {/* Header */}
        <Box className={`items-center p-6 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
          <Box className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-primary-100">{contact.CompanyName ? <BuildingIcon size={28} color="#3b82f6" /> : <UserIcon size={28} color="#3b82f6" />}</Box>
          <Heading size="lg">{displayName}</Heading>
          {contact.CompanyName && contact.FirstName && <Text className="mt-1 text-sm text-typography-500">{[contact.FirstName, contact.LastName].filter(Boolean).join(' ')}</Text>}
          {contact.Email && <Text className="mt-1 text-sm text-primary-500">{contact.Email}</Text>}
        </Box>

        {/* Phone numbers */}
        <Box className={`mt-2 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
          <PhoneRow label={t('contacts.phone')} number={contact.Phone} colorScheme={colorScheme ?? 'light'} />
          <PhoneRow label={t('contacts.mobile')} number={contact.Mobile} colorScheme={colorScheme ?? 'light'} />
          <PhoneRow label={t('contacts.homePhone')} number={contact.HomePhoneNumber} colorScheme={colorScheme ?? 'light'} />
          <PhoneRow label={t('contacts.cellPhone')} number={contact.CellPhoneNumber} colorScheme={colorScheme ?? 'light'} />
          <PhoneRow label={t('contacts.officePhone')} number={contact.OfficePhoneNumber} colorScheme={colorScheme ?? 'light'} />
          <PhoneRow label={t('contacts.faxPhone')} number={contact.FaxPhoneNumber} colorScheme={colorScheme ?? 'light'} />
        </Box>

        {/* Address */}
        {fullAddress && (
          <Pressable onPress={handleAddressPress}>
            <Box className={`mt-2 p-4 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
              <HStack className="items-center gap-3">
                <MapPinIcon size={18} color="#3b82f6" />
                <VStack className="flex-1">
                  <Text className="text-xs text-typography-500">{t('routes.address')}</Text>
                  <Text className="text-sm font-medium">{fullAddress}</Text>
                </VStack>
                {mapCenter && <ExternalLinkIcon size={14} color="#9ca3af" />}
              </HStack>
            </Box>
          </Pressable>
        )}

        {/* Mini Map */}
        {mapCenter && (
          <Box className="mt-2" style={{ height: 220 }}>
            <MapView style={styles.map} styleURL={colorScheme === 'dark' ? StyleURL.Dark : StyleURL.Street} scrollEnabled={false} pitchEnabled={false} rotateEnabled={false}>
              <Camera centerCoordinate={mapCenter} zoomLevel={15} animationMode="moveTo" />
              {locationGps && (
                <PointAnnotation id="location-marker" coordinate={[locationGps.lon, locationGps.lat]}>
                  <View style={styles.markerLocation}>
                    <MapPinIcon size={20} color="#3b82f6" />
                  </View>
                </PointAnnotation>
              )}
              {entranceGps && (
                <PointAnnotation id="entrance-marker" coordinate={[entranceGps.lon, entranceGps.lat]}>
                  <View style={styles.markerEntrance}>
                    <MapPinIcon size={20} color="#22c55e" />
                  </View>
                </PointAnnotation>
              )}
              {exitGps && (
                <PointAnnotation id="exit-marker" coordinate={[exitGps.lon, exitGps.lat]}>
                  <View style={styles.markerExit}>
                    <MapPinIcon size={20} color="#ef4444" />
                  </View>
                </PointAnnotation>
              )}
            </MapView>
            {/* Legend */}
            <HStack className="justify-center gap-4 bg-transparent py-2">
              {locationGps && (
                <HStack className="items-center gap-1">
                  <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                  <Text className="text-xs text-typography-500">{t('routes.location')}</Text>
                </HStack>
              )}
              {entranceGps && (
                <HStack className="items-center gap-1">
                  <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                  <Text className="text-xs text-typography-500">{t('routes.entrance')}</Text>
                </HStack>
              )}
              {exitGps && (
                <HStack className="items-center gap-1">
                  <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                  <Text className="text-xs text-typography-500">{t('routes.exit')}</Text>
                </HStack>
              )}
            </HStack>
          </Box>
        )}

        {/* Description / Notes */}
        {contact.Description && (
          <Box className={`mt-2 p-4 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
            <Text className="mb-1 text-sm font-medium">{t('routes.description')}</Text>
            <Text className="text-sm text-typography-500">{contact.Description}</Text>
          </Box>
        )}

        {contact.Notes && (
          <Box className={`mt-2 p-4 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
            <Text className="mb-1 text-sm font-medium">{t('routes.notes')}</Text>
            <Text className="text-sm text-typography-500">{contact.Notes}</Text>
          </Box>
        )}

        {/* Bottom spacing */}
        <Box className="h-8" />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerLocation: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerEntrance: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerExit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
