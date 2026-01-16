import { Check } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { logger } from '@/lib/logging';
import { type UnitResultData } from '@/models/v4/units/unitResultData';
import { useCoreStore } from '@/stores/app/core-store';
import { useRolesStore } from '@/stores/roles/store';
import { useToastStore } from '@/stores/toast/store';
import { useUnitsStore } from '@/stores/units/store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { Center } from '../ui/center';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Spinner } from '../ui/spinner';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface UnitSelectionBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnitSelectionBottomSheet = React.memo<UnitSelectionBottomSheetProps>(({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(false);
  const { units, fetchUnits, isLoading: isLoadingUnits } = useUnitsStore();
  const { activeUnit, setActiveUnit } = useCoreStore();
  const showToast = useToastStore((state) => state.showToast);
  const isProcessingRef = React.useRef(false);

  // Fetch units when sheet opens
  React.useEffect(() => {
    if (isOpen && units.length === 0) {
      fetchUnits().catch((error) => {
        logger.error({
          message: 'Failed to fetch units',
          context: { error },
        });
      });
    }
  }, [isOpen, units.length, fetchUnits]);

  const handleClose = React.useCallback(() => {
    if (isLoading || isProcessingRef.current) {
      return;
    }
    onClose();
  }, [onClose, isLoading]);

  const handleUnitSelection = React.useCallback(
    async (unit: UnitResultData) => {
      // Prevent multiple concurrent selections using ref guard
      if (isLoading || isProcessingRef.current) {
        return;
      }

      // Additional check for same unit selection
      if (activeUnit?.UnitId === unit.UnitId) {
        logger.info({
          message: 'Same unit already selected, closing modal',
          context: { unitId: unit.UnitId },
        });
        handleClose();
        return;
      }

      try {
        isProcessingRef.current = true;
        setIsLoading(true);
        let hasError = false;

        try {
          await setActiveUnit(unit.UnitId);
          await useRolesStore.getState().fetchRolesForUnit(unit.UnitId);

          logger.info({
            message: 'Active unit updated successfully',
            context: { unitId: unit.UnitId, unitName: unit.Name },
          });

          showToast('success', t('settings.unit_selected_successfully', { unitName: unit.Name }));
        } catch (error) {
          hasError = true;
          logger.error({
            message: 'Failed to update active unit',
            context: { error, unitId: unit.UnitId, unitName: unit.Name },
          });

          showToast('error', t('settings.unit_selection_failed'));
        } finally {
          setIsLoading(false);
          isProcessingRef.current = false;

          // Call handleClose after resetting loading states so it can actually close
          if (!hasError) {
            handleClose();
          }
        }
      } catch (outerError) {
        // This should not happen, but just in case
        setIsLoading(false);
        isProcessingRef.current = false;
      }
    },
    [setActiveUnit, handleClose, isLoading, activeUnit, showToast, t]
  );

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[85]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-white dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full flex-1 p-4">
          <Heading size="lg" className="text-center">
            {t('settings.select_unit')}
          </Heading>

          {/* Current Selection */}
          {activeUnit && (
            <Box className="rounded-lg border border-outline-200 bg-background-50 p-3">
              <VStack space="xs">
                <Text size="sm" className="font-medium text-typography-900">
                  {t('settings.current_unit')}
                </Text>
                <Text size="sm" className="text-typography-600">
                  {activeUnit.Name}
                </Text>
              </VStack>
            </Box>
          )}

          {/* Units List */}
          <VStack className="flex-1" space="sm">
            {isLoading ? (
              <Center className="flex-1 py-8">
                <VStack space="md" className="items-center">
                  <Spinner size="large" />
                  <Text className="text-center text-typography-600">{t('settings.activating_unit')}</Text>
                </VStack>
              </Center>
            ) : (
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false} testID="scroll-view">
                {isLoadingUnits ? (
                  <Center className="py-8">
                    <Spinner size="large" />
                  </Center>
                ) : units.length > 0 ? (
                  <VStack space="sm">
                    {units.map((unit) => (
                      <ActionsheetItem
                        key={unit.UnitId}
                        onPress={() => handleUnitSelection(unit)}
                        disabled={isLoading}
                        className={activeUnit?.UnitId === unit.UnitId ? 'data-[checked=true]:bg-background-100' : ''}
                        testID={`unit-item-${unit.UnitId}`}
                      >
                        <VStack className="flex-1">
                          <ActionsheetItemText size="md" className={activeUnit?.UnitId === unit.UnitId ? 'font-medium' : 'font-normal'}>
                            {unit.Name}
                          </ActionsheetItemText>
                          <ActionsheetItemText size="sm" className="text-typography-500">
                            {unit.Type}
                          </ActionsheetItemText>
                        </VStack>
                        {activeUnit?.UnitId === unit.UnitId && <Check size={20} className="text-primary-600" />}
                      </ActionsheetItem>
                    ))}
                  </VStack>
                ) : (
                  <Center className="py-8">
                    <Text className="text-center text-typography-500">{t('settings.no_units_available')}</Text>
                  </Center>
                )}
              </ScrollView>
            )}
          </VStack>

          {/* Cancel Button - Fixed to bottom */}
          <HStack space="md" className="pt-4">
            <Button variant="outline" className="flex-1" onPress={handleClose} disabled={isLoading} testID="cancel-button">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
});

UnitSelectionBottomSheet.displayName = 'UnitSelectionBottomSheet';
