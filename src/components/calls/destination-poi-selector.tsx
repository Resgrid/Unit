import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { createPoiTypeMap, getPoiSelectionLabel, groupPoisByType } from '@/lib/poi-utils';
import { type PoiResultData, type PoiTypeResultData } from '@/models/v4/mapping/poiResultData';

import { CustomBottomSheet } from '../ui/bottom-sheet';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface DestinationPoiSelectorProps {
  destinationPois: PoiResultData[];
  poiTypes: PoiTypeResultData[];
  selectedPoiId: number | null;
  isLoading: boolean;
  onChange: (poiId: number | null) => void;
}

export const DestinationPoiSelector: React.FC<DestinationPoiSelectorProps> = ({ destinationPois, poiTypes, selectedPoiId, isLoading, onChange }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);

  const poiTypesById = React.useMemo(() => createPoiTypeMap(poiTypes), [poiTypes]);
  const groupedDestinationPois = React.useMemo(() => groupPoisByType(destinationPois, poiTypes), [destinationPois, poiTypes]);
  const selectedPoi = React.useMemo(() => destinationPois.find((poi) => poi.PoiId === selectedPoiId) ?? null, [destinationPois, selectedPoiId]);

  const selectedLabel = selectedPoi ? getPoiSelectionLabel(selectedPoi, poiTypesById) : t('calls.destination_poi_none');

  const handleSelect = (poiId: number | null) => {
    onChange(poiId);
    setIsOpen(false);
  };

  return (
    <>
      <VStack space="xs">
        <Text className="text-sm text-gray-500">{t('calls.destination_poi')}</Text>
        <Button variant="outline" onPress={() => setIsOpen(true)} className="w-full justify-start">
          <ButtonText className="flex-1 text-left" numberOfLines={2}>
            {selectedLabel}
          </ButtonText>
        </Button>
      </VStack>

      <CustomBottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} isLoading={isLoading} loadingText={t('calls.loading_destination_pois')}>
        <Box className="p-4">
          <Text className="mb-4 text-center text-lg font-semibold">{t('calls.select_destination_poi')}</Text>
          <ScrollView className="max-h-96">
            <Button variant={selectedPoiId === null ? 'solid' : 'outline'} className="mb-3 w-full justify-start" onPress={() => handleSelect(null)}>
              <ButtonText className="flex-1 text-left">{t('calls.destination_poi_none')}</ButtonText>
            </Button>

            {groupedDestinationPois.length > 0 ? (
              groupedDestinationPois.map((group) => (
                <VStack key={group.poiTypeId} space="sm" className="mb-4">
                  <Text className="px-1 text-xs font-semibold uppercase text-gray-500">{group.title}</Text>
                  {group.items.map((poi) => (
                    <Button key={poi.PoiId} variant={selectedPoiId === poi.PoiId ? 'solid' : 'outline'} className="w-full justify-start" onPress={() => handleSelect(poi.PoiId)}>
                      <ButtonText className="flex-1 text-left" numberOfLines={2}>
                        {getPoiSelectionLabel(poi, poiTypesById)}
                      </ButtonText>
                    </Button>
                  ))}
                </VStack>
              ))
            ) : (
              <Text className="mt-4 text-center text-gray-500">{t('calls.no_destination_pois_available')}</Text>
            )}
          </ScrollView>
        </Box>
      </CustomBottomSheet>
    </>
  );
};
