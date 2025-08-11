import { ArrowLeft, ArrowRight, CircleIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity } from 'react-native';

import { type CustomStatusResultData } from '@/models/v4/customStatuses/customStatusResultData';
import { SaveUnitStatusInput, SaveUnitStatusRoleInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useRolesStore } from '@/stores/roles/store';
import { useStatusBottomSheetStore, useStatusesStore } from '@/stores/status/store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonText } from '../ui/button';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Radio, RadioGroup, RadioIcon, RadioIndicator, RadioLabel } from '../ui/radio';
import { Spinner } from '../ui/spinner';
import { Text } from '../ui/text';
import { Textarea, TextareaInput } from '../ui/textarea';
import { VStack } from '../ui/vstack';

export const StatusBottomSheet = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const [selectedTab, setSelectedTab] = React.useState<'calls' | 'stations'>('calls');

  // Initialize offline event manager on mount
  React.useEffect(() => {
    offlineEventManager.initialize();
  }, []);
  const {
    isOpen,
    currentStep,
    selectedCall,
    selectedStation,
    selectedDestinationType,
    selectedStatus,
    cameFromStatusSelection,
    note,
    availableCalls,
    availableStations,
    isLoading,
    setIsOpen,
    setCurrentStep,
    setSelectedCall,
    setSelectedStation,
    setSelectedDestinationType,
    setSelectedStatus,
    setNote,
    fetchDestinationData,
    reset,
  } = useStatusBottomSheetStore();

  const { activeUnit, activeCallId, setActiveCall, activeStatuses } = useCoreStore();
  const { unitRoleAssignments } = useRolesStore();
  const { saveUnitStatus } = useStatusesStore();
  const { latitude, longitude, heading, accuracy, speed, altitude, timestamp } = useLocationStore();

  // Helper function to safely get status properties
  const getStatusProperty = React.useCallback(
    <T extends keyof CustomStatusResultData>(prop: T, defaultValue: CustomStatusResultData[T]): CustomStatusResultData[T] => {
      if (!selectedStatus) return defaultValue;
      return (selectedStatus as any)[prop] ?? defaultValue;
    },
    [selectedStatus]
  );

  const handleClose = () => {
    reset();
  };

  const handleCallSelect = (callId: string) => {
    const call = availableCalls.find((c) => c.CallId === callId);
    if (call) {
      setSelectedCall(call);
      setSelectedDestinationType('call');
      setSelectedStation(null);

      // Set as active call if it's not already the active call
      if (activeCallId !== call.CallId) {
        setActiveCall(call.CallId);
      }
    }
  };

  const handleStationSelect = (stationId: string) => {
    const station = availableStations.find((s) => s.GroupId === stationId);
    if (station) {
      setSelectedStation(station);
      setSelectedDestinationType('station');
      setSelectedCall(null);
    }
  };

  const handleNoDestinationSelect = () => {
    setSelectedDestinationType('none');
    setSelectedCall(null);
    setSelectedStation(null);
  };

  const handleNext = () => {
    if (!canProceedFromCurrentStep()) {
      return;
    }

    if (currentStep === 'select-status') {
      // Move to destination selection after status is selected
      const detailLevel = getStatusProperty('Detail', 0);
      if (detailLevel > 0) {
        setCurrentStep('select-destination');
      } else {
        // Check if note is required/optional based on selectedStatus
        const noteLevel = getStatusProperty('Note', 0);
        if (noteLevel === 0) {
          // No note step, go straight to submission
          handleSubmit();
        } else {
          setCurrentStep('add-note');
        }
      }
    } else if (currentStep === 'select-destination') {
      // Check if note is required/optional based on selectedStatus
      const noteLevel = getStatusProperty('Note', 0);
      if (noteLevel === 0) {
        // No note step, go straight to submission
        handleSubmit();
      } else {
        setCurrentStep('add-note');
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep === 'add-note') {
      const detailLevel = getStatusProperty('Detail', 0);
      if (detailLevel > 0) {
        setCurrentStep('select-destination');
      } else {
        setCurrentStep('select-status');
      }
    } else if (currentStep === 'select-destination') {
      setCurrentStep('select-status');
    }
  };

  const handleStatusSelect = (statusId: string) => {
    if (activeStatuses?.Statuses) {
      const status = activeStatuses.Statuses.find((s) => s.Id.toString() === statusId);
      if (status) {
        setSelectedStatus(status);
      }
    }
  };

  const handleSubmit = React.useCallback(async () => {
    try {
      if (!selectedStatus || !activeUnit) return;

      const input = new SaveUnitStatusInput();
      input.Id = activeUnit.UnitId;
      input.Type = getStatusProperty('Id', '0');
      input.Note = note;

      // Set RespondingTo based on destination selection
      if (selectedDestinationType === 'call' && selectedCall) {
        input.RespondingTo = selectedCall.CallId;
      } else if (selectedDestinationType === 'station' && selectedStation) {
        input.RespondingTo = selectedStation.GroupId;
      }

      // Include GPS coordinates if available
      if (latitude !== null && longitude !== null) {
        input.Latitude = latitude.toString();
        input.Longitude = longitude.toString();
        input.Accuracy = accuracy?.toString() || '0';
        input.Altitude = altitude?.toString() || '0';
        input.Speed = speed?.toString() || '0';
        input.Heading = heading?.toString() || '0';

        // Set timestamp from location if available, otherwise use current time
        if (timestamp) {
          const locationDate = new Date(timestamp);
          input.Timestamp = locationDate.toISOString();
          input.TimestampUtc = locationDate.toUTCString().replace('UTC', 'GMT');
        }
      }

      // Add role assignments
      input.Roles = unitRoleAssignments.map((assignment) => {
        const roleInput = new SaveUnitStatusRoleInput();
        roleInput.RoleId = assignment.UnitRoleId;
        roleInput.UserId = assignment.UserId;
        return roleInput;
      });

      await saveUnitStatus(input);
      reset();
    } catch (error) {
      console.error('Failed to save unit status:', error);
    }
  }, [
    selectedStatus,
    activeUnit,
    note,
    selectedDestinationType,
    selectedCall,
    selectedStation,
    unitRoleAssignments,
    saveUnitStatus,
    reset,
    getStatusProperty,
    latitude,
    longitude,
    heading,
    accuracy,
    speed,
    altitude,
    timestamp,
  ]);

  // Fetch destination data when status bottom sheet opens
  React.useEffect(() => {
    if (isOpen && activeUnit && selectedStatus) {
      fetchDestinationData(activeUnit.UnitId);
    }
  }, [isOpen, activeUnit, selectedStatus, fetchDestinationData]);

  // Pre-select active call when opening with calls enabled
  React.useEffect(() => {
    // Only pre-select if:
    // 1. Status bottom sheet is open and not loading
    // 2. Status has calls enabled (detailLevel 2 or 3)
    // 3. There's an active call and it's in the available calls
    // 4. No call is currently selected and destination type is 'none'
    if (isOpen && !isLoading && selectedStatus && (selectedStatus.Detail === 2 || selectedStatus.Detail === 3) && activeCallId && availableCalls.length > 0 && !selectedCall && selectedDestinationType === 'none') {
      const activeCall = availableCalls.find((call) => call.CallId === activeCallId);
      if (activeCall) {
        setSelectedCall(activeCall);
        setSelectedDestinationType('call');
      }
    }
  }, [isOpen, isLoading, selectedStatus, activeCallId, availableCalls, selectedCall, selectedDestinationType, setSelectedCall, setSelectedDestinationType]);

  // Determine step logic
  const detailLevel = getStatusProperty('Detail', 0);
  const shouldShowDestinationStep = detailLevel > 0;
  const isNoteRequired = getStatusProperty('Note', 0) === 1;
  const isNoteOptional = getStatusProperty('Note', 0) === 2;

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select-status':
        return t('status.select_status');
      case 'select-destination':
        return t('status.select_destination', { status: selectedStatus?.Text });
      case 'add-note':
        return t('status.add_note');
      default:
        return t('status.set_status');
    }
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'select-status':
        return 1;
      case 'select-destination':
        return cameFromStatusSelection ? 2 : 1; // Step 2 if from status selection, step 1 if pre-selected
      case 'add-note':
        if (cameFromStatusSelection) {
          // New flow: step 1 = status, step 2 = destination, step 3 = note
          return shouldShowDestinationStep ? 3 : 2;
        } else {
          // Old flow: step 1 = destination, step 2 = note
          return shouldShowDestinationStep ? 2 : 1;
        }
      default:
        return 1;
    }
  };

  const getTotalSteps = () => {
    if (cameFromStatusSelection) {
      // New flow calculation
      let totalSteps = 1; // Always have status selection

      if (selectedStatus) {
        // We can determine exact steps based on the selected status
        const hasDestinationSelection = getStatusProperty('Detail', 0) > 0;
        const hasNoteStep = getStatusProperty('Note', 0) > 0;

        if (hasDestinationSelection) totalSteps++;
        if (hasNoteStep) totalSteps++;
      } else {
        // Conservative estimate when no status is selected yet
        // Look at available statuses to determine potential steps
        if (activeStatuses?.Statuses && activeStatuses.Statuses.length > 0) {
          const hasAnyDestination = activeStatuses.Statuses.some((s) => s.Detail > 0);
          const hasAnyNote = activeStatuses.Statuses.some((s) => s.Note > 0);

          if (hasAnyDestination) totalSteps++;
          if (hasAnyNote) totalSteps++;
        } else {
          // Fallback: assume all steps
          totalSteps = 3;
        }
      }

      return totalSteps;
    } else {
      // Old flow calculation
      const hasDestinationSelection = shouldShowDestinationStep;
      const hasNoteStep = isNoteRequired || isNoteOptional;

      let totalSteps = 0;
      if (hasDestinationSelection) totalSteps++;
      if (hasNoteStep) totalSteps++;

      return Math.max(totalSteps, 1);
    }
  };

  const canProceedFromCurrentStep = () => {
    switch (currentStep) {
      case 'select-status':
        return !!selectedStatus; // Must have a status selected
      case 'select-destination':
        return true; // Can proceed with any selection including none
      case 'add-note':
        return !isNoteRequired || note.trim().length > 0; // Note required check
      default:
        return false;
    }
  };

  const getSelectedDestinationDisplay = () => {
    if (selectedDestinationType === 'call' && selectedCall) {
      return `${selectedCall.Number} - ${selectedCall.Name}`;
    } else if (selectedDestinationType === 'station' && selectedStation) {
      return selectedStation.Name;
    } else {
      return t('status.no_destination');
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[85]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-white dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full p-4">
          {/* Step indicator */}
          <HStack space="sm" className="mb-2 justify-center">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.step')} {getStepNumber()} {t('common.of')} {getTotalSteps()}
            </Text>
          </HStack>

          <Heading size="lg" className="mb-4 text-center">
            {getStepTitle()}
          </Heading>

          {currentStep === 'select-status' && (
            <VStack space="md" className="w-full">
              <Text className="mb-2 font-medium">{t('status.select_status_type')}</Text>

              <ScrollView className="max-h-[400px]">
                <RadioGroup value={selectedStatus?.Id.toString() || ''} onChange={handleStatusSelect}>
                  {activeStatuses?.Statuses && activeStatuses.Statuses.length > 0 ? (
                    activeStatuses.Statuses.map((status) => (
                      <Radio key={status.Id} value={status.Id.toString()} className="mb-3 py-2">
                        <RadioIndicator>
                          <RadioIcon as={CircleIcon} />
                        </RadioIndicator>
                        <RadioLabel>
                          <VStack>
                            <Text className="font-bold" style={{ color: status.Color || undefined }}>
                              {status.Text}
                            </Text>
                            {status.Detail > 0 && (
                              <Text className="text-sm text-gray-600 dark:text-gray-400">
                                {status.Detail === 1 && t('status.station_destination_enabled')}
                                {status.Detail === 2 && t('status.call_destination_enabled')}
                                {status.Detail === 3 && t('status.both_destinations_enabled')}
                              </Text>
                            )}
                            {status.Note > 0 && (
                              <Text className="text-xs text-gray-500 dark:text-gray-500">
                                {status.Note === 1 && t('status.note_required')}
                                {status.Note === 2 && t('status.note_optional')}
                              </Text>
                            )}
                          </VStack>
                        </RadioLabel>
                      </Radio>
                    ))
                  ) : (
                    <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_statuses_available')}</Text>
                  )}
                </RadioGroup>
              </ScrollView>

              <HStack space="sm" className="mt-4 justify-end">
                <Button onPress={handleNext} isDisabled={!canProceedFromCurrentStep()} className="bg-blue-600">
                  <ButtonText>{t('common.next')}</ButtonText>
                  <ArrowRight size={16} color={colorScheme === 'dark' ? '#fff' : '#fff'} />
                </Button>
              </HStack>
            </VStack>
          )}

          {currentStep === 'select-destination' && shouldShowDestinationStep && (
            <VStack space="md" className="w-full">
              <Text className="mb-2 font-medium">{t('status.select_destination_type')}</Text>

              {/* No Destination Option */}
              <TouchableOpacity
                onPress={handleNoDestinationSelect}
                className={`mb-4 rounded-lg border-2 p-3 ${selectedDestinationType === 'none' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
              >
                <HStack space="sm" className="items-center">
                  <CircleIcon size={20} color={selectedDestinationType === 'none' ? '#3b82f6' : '#9ca3af'} fill={selectedDestinationType === 'none' ? '#3b82f6' : 'none'} />
                  <VStack className="flex-1">
                    <Text className="font-bold">{t('status.no_destination')}</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400">{t('status.general_status')}</Text>
                  </VStack>
                </HStack>
              </TouchableOpacity>

              {/* Show tabs only if we have both calls and stations to choose from */}
              {((detailLevel === 1 && availableStations.length > 0) || (detailLevel === 2 && availableCalls.length > 0) || (detailLevel === 3 && (availableCalls.length > 0 || availableStations.length > 0))) && (
                <>
                  {/* Tab Headers - only show if we have both types or multiple options */}
                  {detailLevel === 3 && (
                    <HStack space="xs" className="mb-4">
                      <TouchableOpacity onPress={() => setSelectedTab('calls')} className={`flex-1 rounded-lg py-3 ${selectedTab === 'calls' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <Text className={`text-center font-semibold ${selectedTab === 'calls' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{t('status.calls_tab')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setSelectedTab('stations')} className={`flex-1 rounded-lg py-3 ${selectedTab === 'stations' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <Text className={`text-center font-semibold ${selectedTab === 'stations' ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{t('status.stations_tab')}</Text>
                      </TouchableOpacity>
                    </HStack>
                  )}

                  {/* Tab Content */}
                  <ScrollView className="max-h-[300px]">
                    {/* Show calls if detailLevel 2 or 3, and either no tabs or calls tab selected */}
                    {(detailLevel === 2 || (detailLevel === 3 && selectedTab === 'calls')) && (
                      <RadioGroup value={selectedCall?.CallId || ''} onChange={handleCallSelect}>
                        {isLoading ? (
                          <VStack space="md" className="w-full items-center justify-center">
                            <Spinner size="large" />
                            <Text className="text-center text-gray-600 dark:text-gray-400">{t('calls.loading_calls')}</Text>
                          </VStack>
                        ) : availableCalls && availableCalls.length > 0 ? (
                          availableCalls.map((call) => (
                            <Radio key={call.CallId} value={call.CallId} className="mb-3 py-2">
                              <RadioIndicator>
                                <RadioIcon as={CircleIcon} />
                              </RadioIndicator>
                              <RadioLabel>
                                <VStack>
                                  <Text className="font-bold">
                                    {call.Number} - {call.Name}
                                  </Text>
                                  <Text className="text-sm text-gray-600 dark:text-gray-400">{call.Address}</Text>
                                </VStack>
                              </RadioLabel>
                            </Radio>
                          ))
                        ) : (
                          <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('calls.no_calls_available')}</Text>
                        )}
                      </RadioGroup>
                    )}

                    {/* Show stations if detailLevel 1 or 3, and either no tabs or stations tab selected */}
                    {(detailLevel === 1 || (detailLevel === 3 && selectedTab === 'stations')) && (
                      <RadioGroup value={selectedStation?.GroupId || ''} onChange={handleStationSelect}>
                        {isLoading ? (
                          <VStack space="md" className="w-full items-center justify-center">
                            <Spinner size="large" />
                            <Text className="text-center text-gray-600 dark:text-gray-400">{t('status.loading_stations')}</Text>
                          </VStack>
                        ) : availableStations && availableStations.length > 0 ? (
                          availableStations.map((station) => (
                            <Radio key={station.GroupId} value={station.GroupId} className="mb-3 py-2">
                              <RadioIndicator>
                                <RadioIcon as={CircleIcon} />
                              </RadioIndicator>
                              <RadioLabel>
                                <VStack>
                                  <Text className="font-bold">{station.Name}</Text>
                                  {station.Address && <Text className="text-sm text-gray-600 dark:text-gray-400">{station.Address}</Text>}
                                  {station.GroupType && <Text className="text-xs text-gray-500 dark:text-gray-500">{station.GroupType}</Text>}
                                </VStack>
                              </RadioLabel>
                            </Radio>
                          ))
                        ) : (
                          <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_stations_available')}</Text>
                        )}
                      </RadioGroup>
                    )}
                  </ScrollView>
                </>
              )}

              <HStack space="sm" className="mt-4 justify-end">
                <Button onPress={handleNext} isDisabled={!canProceedFromCurrentStep()} className="bg-blue-600">
                  <ButtonText>{t('common.next')}</ButtonText>
                  <ArrowRight size={16} color={colorScheme === 'dark' ? '#fff' : '#fff'} />
                </Button>
              </HStack>
            </VStack>
          )}

          {currentStep === 'select-destination' && !shouldShowDestinationStep && (
            // If Detail = 0, skip destination step and show note step directly
            <VStack space="md" className="w-full">
              {isNoteRequired || isNoteOptional ? (
                <>
                  <Text className="mb-2 font-medium">{t('status.add_note')}</Text>
                  <Textarea size="md" className="min-h-[100px] w-full">
                    <TextareaInput placeholder={isNoteRequired ? t('status.note_required') : t('status.note_optional')} value={note} onChangeText={setNote} />
                  </Textarea>
                </>
              ) : null}
              <Button onPress={handleSubmit} className="w-full bg-blue-600" isDisabled={isNoteRequired && !note.trim()}>
                <ButtonText>{t('common.submit')}</ButtonText>
              </Button>
            </VStack>
          )}

          {currentStep === 'add-note' && (
            <VStack space="md" className="w-full">
              <VStack space="sm">
                <Text className="font-medium">{t('status.selected_destination')}:</Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400">{getSelectedDestinationDisplay()}</Text>
              </VStack>

              <VStack space="sm">
                <Text className="font-medium">
                  {t('status.note')} {isNoteRequired ? '' : `(${t('common.optional')})`}:
                </Text>
                <Textarea size="md" className="min-h-[100px] w-full">
                  <TextareaInput placeholder={isNoteRequired ? t('status.note_required') : t('status.note_optional')} value={note} onChangeText={setNote} />
                </Textarea>
              </VStack>

              <HStack space="sm" className="mt-4 justify-between">
                <Button variant="outline" onPress={handlePrevious} className="flex-1">
                  <ArrowLeft size={16} color={colorScheme === 'dark' ? '#737373' : '#737373'} />
                  <ButtonText>{t('common.previous')}</ButtonText>
                </Button>
                <Button onPress={handleSubmit} isDisabled={!canProceedFromCurrentStep()} className="flex-1 bg-blue-600">
                  <ButtonText>{t('common.submit')}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
