import { MapPin, Navigation, Tag } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';

interface PoiCardProps {
  poi: PoiResultData;
  poiTypeLabel: string;
  displayName: string;
  isDestinationEnabled: boolean;
  onPress: () => void;
}

export const PoiCard: React.FC<PoiCardProps> = ({ poi, poiTypeLabel, displayName, isDestinationEnabled, onPress }) => {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress}>
      <Box className="mb-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
        <HStack className="items-start justify-between gap-3">
          <VStack className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{displayName}</Text>

            {poi.Address ? (
              <HStack className="mt-2 items-center gap-2">
                <MapPin size={14} color="#6b7280" />
                <Text className="flex-1 text-sm text-gray-600 dark:text-gray-400">{poi.Address}</Text>
              </HStack>
            ) : null}

            {poi.Note ? (
              <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400" numberOfLines={2}>
                {poi.Note}
              </Text>
            ) : null}

            <HStack className="mt-3 items-center gap-2">
              <Badge action="muted" variant="outline">
                <BadgeText>{poiTypeLabel}</BadgeText>
              </Badge>
              {isDestinationEnabled ? (
                <Badge action="success" variant="solid">
                  <BadgeText>{t('routes.poi_destination_enabled')}</BadgeText>
                </Badge>
              ) : null}
            </HStack>
          </VStack>
        </HStack>

        <HStack className="mt-4 items-center gap-2">
          <Navigation size={14} color="#2563eb" />
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">{t('routes.view_on_map')}</Text>
          <Tag size={14} color="#9ca3af" />
          <Text className="text-xs text-gray-500 dark:text-gray-400">{t('routes.poi_coordinates_compact', { latitude: poi.Latitude.toFixed(4), longitude: poi.Longitude.toFixed(4) })}</Text>
        </HStack>
      </Box>
    </Pressable>
  );
};
