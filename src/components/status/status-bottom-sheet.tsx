import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useStatusBottomSheetStore,
  useStatusesStore,
} from '@/stores/status/store';
import { invertColor } from '@/lib';
import { Button, ButtonText } from '../ui/button';
import { VStack } from '../ui/vstack';
import { useCoreStore } from '@/stores/app/core-store';
import { Text } from '../ui/text';
import { Textarea, TextareaInput } from '../ui/textarea';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '../ui/actionsheet';
import { Heading } from '../ui/heading';
import { useCallsStore } from '@/stores/calls/store';
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator,
  RadioLabel,
} from '../ui/radio';
import { HStack } from '../ui/hstack';
import { ScrollView } from 'react-native';
import { CircleIcon } from 'lucide-react-native';
import { SaveUnitStatusInput } from '@/models/v4/unitStatus/saveUnitStatusInput';

export const StatusBottomSheet = () => {
  const { t } = useTranslation();
  const {
    isOpen,
    currentStep,
    selectedCall,
    selectedStatus,
    note,
    setIsOpen,
    setCurrentStep,
    setSelectedCall,
    setNote,
    reset,
  } = useStatusBottomSheetStore();

  const { activeCall } = useCoreStore();
  const { calls } = useCallsStore();

  const handleClose = () => {
    reset();
  };

  const handleNext = () => {
    if (currentStep === 'select-call') {
      setCurrentStep('add-note');
    }
  };

  const handleSubmit = async () => {
    await useStatusesStore
      .getState()
      .saveUnitStatus(selectedStatus?.Id.toString() || '', note);

    // TODO: Implement status update logic here
    reset();
  };

  const handleCallSelect = (callId: string) => {
    const call = calls.find((c) => c.CallId === callId);
    if (call) {
      setSelectedCall(call);
    }
  };

  React.useEffect(() => {
    if (activeCall && currentStep === 'select-call' && !selectedCall) {
      setSelectedCall(activeCall);
    }
  }, [activeCall, currentStep, selectedCall]);

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-white dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="p-4 w-full">
          <Heading size="lg" className="mb-4">
            {currentStep === 'select-call'
              ? t('Set Status: {{status}}', { status: selectedStatus?.Text })
              : t('Add Note (Optional)')}
          </Heading>

          {currentStep === 'select-call' ? (
            <VStack space="md" className="w-full">
              <Text className="font-medium mb-2">{t('Select a Call')}</Text>

              {calls && calls.length > 0 ? (
                <ScrollView className="max-h-[300px]">
                  <RadioGroup
                    value={selectedCall?.CallId || ''}
                    onChange={handleCallSelect}
                  >
                    <Radio key="0" value="0" className="mb-3 py-2">
                      <RadioIndicator>
                        <RadioIcon as={CircleIcon} />
                      </RadioIndicator>
                      <RadioLabel>
                        <VStack>
                          <Text className="font-bold">
                            {t('calls.no_call_selected')}
                          </Text>
                        </VStack>
                      </RadioLabel>
                    </Radio>
                    {calls.map((call) => (
                      <Radio
                        key={call.CallId}
                        value={call.CallId}
                        className="mb-3 py-2"
                      >
                        <RadioIndicator>
                          <RadioIcon as={CircleIcon} />
                        </RadioIndicator>
                        <RadioLabel>
                          <VStack>
                            <Text className="font-bold">
                              {call.Number} - {call.Name}
                            </Text>
                            <Text className="text-sm text-gray-600 dark:text-gray-400">
                              {call.Address}
                            </Text>
                          </VStack>
                        </RadioLabel>
                      </Radio>
                    ))}
                  </RadioGroup>
                </ScrollView>
              ) : (
                <Text className="text-gray-600 dark:text-gray-400 italic">
                  {t('No calls available')}
                </Text>
              )}

              <Button
                onPress={handleNext}
                isDisabled={!selectedCall}
                className="w-full bg-blue-600 mt-4"
              >
                <ButtonText>{t('Next')}</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack space="md" className="w-full">
              <Text className="font-medium mb-2">
                {t('Selected Call')}: {selectedCall?.Number} -{' '}
                {selectedCall?.Name}
              </Text>

              <Textarea size="md" className="w-full min-h-[100px]">
                <TextareaInput
                  placeholder={t('Enter optional note...')}
                  value={note}
                  onChangeText={setNote}
                />
              </Textarea>
              <Button onPress={handleSubmit} className="w-full bg-blue-600">
                <ButtonText>{t('Submit')}</ButtonText>
              </Button>
            </VStack>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
