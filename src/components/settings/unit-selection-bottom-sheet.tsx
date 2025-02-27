import React from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicatorWrapper,
  ActionsheetDragIndicator,
} from '../ui/actionsheet';
import { ButtonText, ButtonSpinner, Button } from '../ui/button';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Text } from '../ui/text';
import { Spinner } from '../ui/spinner';
import { Pressable } from '../ui/pressable';
import { Center } from '../ui/center';
import { ScrollView } from '../ui/scroll-view';
import { useUnitsStore } from '@/stores/units/store';
import { useCoreStore } from '@/stores/app/core-store';
import { logger } from '@/lib/logging';
import { Check } from 'lucide-react-native';
import { UnitResultData } from '@/models/v4/units/unitResultData';

interface UnitSelectionBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UnitSelectionBottomSheet({
  isOpen,
  onClose,
}: UnitSelectionBottomSheetProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const [isLoading, setIsLoading] = React.useState(false);
  const { units, fetchUnits, isLoading: isLoadingUnits } = useUnitsStore();
  const { activeUnit, setActiveUnit } = useCoreStore();

  React.useEffect(() => {
    if (isOpen) {
      fetchUnits().catch((error) => {
        logger.error({
          message: 'Failed to fetch units',
          context: { error },
        });
      });
    }
  }, [isOpen, fetchUnits]);

  const handleUnitSelection = React.useCallback(
    async (unit: UnitResultData) => {
      try {
        setIsLoading(true);
        await setActiveUnit(unit.UnitId);
        logger.info({
          message: 'Active unit updated successfully',
          context: { unitId: unit.UnitId },
        });
        onClose();
      } catch (error) {
        logger.error({
          message: 'Failed to update active unit',
          context: { error },
        });
      } finally {
        setIsLoading(false);
      }
    },
    [setActiveUnit, onClose]
  );

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        className={`rounded-t-3xl px-4 pb-6 ${
          colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'
        }`}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="lg" className="w-full mt-4">
          <Text
            size="lg"
            className={`font-medium ${
              colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'
            }`}
          >
            {t('settings.select_unit')}
          </Text>

          {isLoadingUnits ? (
            <Center className="py-8">
              <Spinner size="large" />
            </Center>
          ) : units.length === 0 ? (
            <Center className="py-8">
              <Text
                className={`text-center ${
                  colorScheme === 'dark'
                    ? 'text-neutral-400'
                    : 'text-neutral-500'
                }`}
              >
                {t('settings.no_units_available')}
              </Text>
            </Center>
          ) : (
            <ScrollView className="max-h-96">
              <VStack space="sm">
                {units.map((unit) => (
                  <Pressable
                    key={unit.UnitId}
                    onPress={() => handleUnitSelection(unit)}
                    disabled={isLoading}
                    className={`p-4 rounded-lg border ${
                      colorScheme === 'dark'
                        ? 'border-neutral-800 bg-neutral-800'
                        : 'border-neutral-200 bg-neutral-50'
                    } ${
                      activeUnit?.UnitId === unit.UnitId
                        ? colorScheme === 'dark'
                          ? 'bg-primary-900'
                          : 'bg-primary-50'
                        : ''
                    }`}
                  >
                    <HStack space="md" className="items-center justify-between">
                      <VStack>
                        <Text
                          className={`font-medium ${
                            colorScheme === 'dark'
                              ? 'text-neutral-200'
                              : 'text-neutral-700'
                          }`}
                        >
                          {unit.Name}
                        </Text>
                        <Text
                          size="sm"
                          className={
                            colorScheme === 'dark'
                              ? 'text-neutral-400'
                              : 'text-neutral-500'
                          }
                        >
                          {unit.Type}
                        </Text>
                      </VStack>
                      {activeUnit?.UnitId === unit.UnitId && (
                        <Check
                          size={20}
                          className={
                            colorScheme === 'dark'
                              ? 'text-primary-400'
                              : 'text-primary-600'
                          }
                        />
                      )}
                    </HStack>
                  </Pressable>
                ))}
              </VStack>
            </ScrollView>
          )}

          <HStack space="md" className="mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onPress={onClose}
              disabled={isLoading}
            >
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
