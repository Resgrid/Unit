import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { InteractionManager, ScrollView, TouchableOpacity } from 'react-native';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { logger } from '@/lib/logging';
import { createPoiTypeMap, getPoiSelectionLabel } from '@/lib/poi-utils';
import { invertColor } from '@/lib/utils';
import { CustomStateDetailTypes, statusDetailAllowsCalls, statusDetailAllowsPois, statusDetailAllowsStations } from '@/models/v4/customStatuses/customStateDetailTypes';
import { DestinationEntityTypes } from '@/models/v4/destinations/destinationEntityTypes';
import { SaveUnitStatusInput, SaveUnitStatusRoleInput } from '@/models/v4/unitStatus/saveUnitStatusInput';
import { acquireLocationFix, getLocationFixErrorMessage } from '@/services/location-fix';
import { offlineEventManager } from '@/services/offline-event-manager.service';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useRolesStore } from '@/stores/roles/store';
import { useStatusBottomSheetStore, useStatusesStore } from '@/stores/status/store';
import { useToastStore } from '@/stores/toast/store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonText } from '../ui/button';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Spinner } from '../ui/spinner';
import { Text } from '../ui/text';
import { Textarea, TextareaInput } from '../ui/textarea';
import { VStack } from '../ui/vstack';

type DestinationTab = 'call' | 'station' | 'poi';

const getDestinationTabs = (detail: number): DestinationTab[] => {
  const tabs: DestinationTab[] = [];

  if (statusDetailAllowsCalls(detail)) {
    tabs.push('call');
  }

  if (statusDetailAllowsStations(detail)) {
    tabs.push('station');
  }

  if (statusDetailAllowsPois(detail)) {
    tabs.push('poi');
  }

  return tabs;
};

const getDestinationTabTranslationKey = (tab: DestinationTab): string => {
  switch (tab) {
    case 'call':
      return 'status.calls_tab';
    case 'station':
      return 'status.stations_tab';
    case 'poi':
      return 'status.pois_tab';
  }
};

const getPreferredDestinationTab = ({
  tabs,
  selectedDestinationType,
  hasSelectedCall,
  hasSelectedStation,
  hasSelectedPoi,
}: {
  tabs: DestinationTab[];
  selectedDestinationType: 'none' | 'call' | 'station' | 'poi';
  hasSelectedCall: boolean;
  hasSelectedStation: boolean;
  hasSelectedPoi: boolean;
}): DestinationTab => {
  if (selectedDestinationType !== 'none' && tabs.includes(selectedDestinationType)) {
    return selectedDestinationType;
  }

  if (hasSelectedCall && tabs.includes('call')) {
    return 'call';
  }

  if (hasSelectedStation && tabs.includes('station')) {
    return 'station';
  }

  if (hasSelectedPoi && tabs.includes('poi')) {
    return 'poi';
  }

  return tabs[0] ?? 'call';
};

export const StatusBottomSheet = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const keyboardHeight = useKeyboardHeight();
  const [selectedTab, setSelectedTab] = React.useState<DestinationTab>('call');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const showToast = useToastStore((state) => state.showToast);

  React.useEffect(() => {
    offlineEventManager.initialize();
  }, []);

  const isOpen = useStatusBottomSheetStore((state) => state.isOpen);
  const currentStep = useStatusBottomSheetStore((state) => state.currentStep);
  const selectedCall = useStatusBottomSheetStore((state) => state.selectedCall);
  const selectedStation = useStatusBottomSheetStore((state) => state.selectedStation);
  const selectedPoi = useStatusBottomSheetStore((state) => state.selectedPoi);
  const selectedDestinationType = useStatusBottomSheetStore((state) => state.selectedDestinationType);
  const selectedStatus = useStatusBottomSheetStore((state) => state.selectedStatus);
  const cameFromStatusSelection = useStatusBottomSheetStore((state) => state.cameFromStatusSelection);
  const note = useStatusBottomSheetStore((state) => state.note);
  const availableCalls = useStatusBottomSheetStore((state) => state.availableCalls);
  const availableStations = useStatusBottomSheetStore((state) => state.availableStations);
  const availablePois = useStatusBottomSheetStore((state) => state.availablePois);
  const availablePoiTypes = useStatusBottomSheetStore((state) => state.availablePoiTypes);
  const isLoading = useStatusBottomSheetStore((state) => state.isLoading);
  const setCurrentStep = useStatusBottomSheetStore((state) => state.setCurrentStep);
  const setSelectedCall = useStatusBottomSheetStore((state) => state.setSelectedCall);
  const setSelectedStation = useStatusBottomSheetStore((state) => state.setSelectedStation);
  const setSelectedPoi = useStatusBottomSheetStore((state) => state.setSelectedPoi);
  const setSelectedDestinationType = useStatusBottomSheetStore((state) => state.setSelectedDestinationType);
  const setSelectedStatus = useStatusBottomSheetStore((state) => state.setSelectedStatus);
  const setNote = useStatusBottomSheetStore((state) => state.setNote);
  const fetchDestinationData = useStatusBottomSheetStore((state) => state.fetchDestinationData);
  const reset = useStatusBottomSheetStore((state) => state.reset);

  const activeUnit = useCoreStore((state) => state.activeUnit);
  const activeCallId = useCoreStore((state) => state.activeCallId);
  const setActiveCall = useCoreStore((state) => state.setActiveCall);
  const activeStatuses = useCoreStore((state) => state.activeStatuses);
  const unitRoleAssignments = useRolesStore((state) => state.unitRoleAssignments);
  const saveUnitStatus = useStatusesStore((state) => state.saveUnitStatus);
  // NOTE: location is read via useLocationStore.getState() inside handleSubmit
  // instead of subscribing — this sheet is mounted at the root and subscribing
  // here re-rendered the whole 900-line component on every GPS fix, even when
  // the sheet is closed.

  const poiTypesById = React.useMemo(() => createPoiTypeMap(availablePoiTypes), [availablePoiTypes]);

  const getStatusProperty = React.useCallback(
    (prop: 'Detail' | 'Note', defaultValue: number): number => {
      if (!selectedStatus) {
        return defaultValue;
      }

      const value = Number(selectedStatus[prop]);
      return Number.isNaN(value) ? defaultValue : value;
    },
    [selectedStatus]
  );

  const getStatusId = React.useCallback((): string => {
    if (!selectedStatus) {
      return '0';
    }

    return selectedStatus.Id.toString();
  }, [selectedStatus]);

  const detailLevel = getStatusProperty('Detail', 0);
  const shouldShowDestinationStep = detailLevel > 0;
  const destinationTabs = React.useMemo(() => getDestinationTabs(detailLevel), [detailLevel]);
  const noteType = getStatusProperty('Note', 0);
  const isNoteRequired = noteType === 2;
  const isNoteOptional = noteType === 1;
  const activeCallCandidate = React.useMemo(() => {
    if (!activeCallId) {
      return null;
    }

    return availableCalls.find((call) => call.CallId === activeCallId) ?? null;
  }, [activeCallId, availableCalls]);

  // When the active call is auto-selected the destination list should scroll it
  // into view. The id is parked here until the selected row's onLayout reports
  // where it landed (the list may not even be mounted yet — e.g. the user is
  // still on the status step).
  const destinationScrollRef = React.useRef<ScrollView>(null);
  const pendingScrollToCallIdRef = React.useRef<string | null>(null);
  // Row offsets captured from onLayout. onLayout only fires when a row is
  // (re)measured, so a scroll request armed after the list already settled would
  // otherwise never be acted on — these let it resolve immediately instead.
  const callRowOffsetsRef = React.useRef<Record<string, number>>({});

  const scrollDestinationToOffset = React.useCallback((y: number) => {
    destinationScrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, []);

  /** Run a pending scroll request as soon as the target row's offset is known. */
  const flushPendingCallScroll = React.useCallback(() => {
    const callId = pendingScrollToCallIdRef.current;
    if (!callId) {
      return;
    }

    const offset = callRowOffsetsRef.current[callId];
    if (offset == null) {
      return;
    }

    pendingScrollToCallIdRef.current = null;
    scrollDestinationToOffset(offset);
  }, [scrollDestinationToOffset]);

  React.useEffect(() => {
    if (!isOpen) {
      pendingScrollToCallIdRef.current = null;
      callRowOffsetsRef.current = {};
    }
  }, [isOpen]);

  // The keyboard padding on ActionsheetContent reserves the covered strip, but it
  // doesn't move the note field there — if the field sits below the fold it stays
  // hidden under the keyboard. The note and its submit button are the last content
  // in both note-entry steps, so scrolling to the end brings them into view once
  // the padded layout settles.
  const noteScrollRef = React.useRef<ScrollView>(null);
  const isOnNoteEntryStep = currentStep === 'add-note' || (currentStep === 'select-destination' && !shouldShowDestinationStep);

  React.useEffect(() => {
    if (keyboardHeight <= 0 || !isOnNoteEntryStep) {
      return;
    }

    const timeoutId = setTimeout(() => {
      noteScrollRef.current?.scrollToEnd({ animated: true });
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [keyboardHeight, isOnNoteEntryStep]);

  React.useEffect(() => {
    if (isOpen && activeUnit) {
      fetchDestinationData(activeUnit.UnitId);
    }
  }, [activeUnit, fetchDestinationData, isOpen]);

  React.useEffect(() => {
    if (!selectedStatus) {
      return;
    }

    const allowsCalls = statusDetailAllowsCalls(detailLevel);
    const allowsStations = statusDetailAllowsStations(detailLevel);
    const allowsPois = statusDetailAllowsPois(detailLevel);

    if (!allowsCalls && selectedCall) {
      setSelectedCall(null);
    }

    if (!allowsStations && selectedStation) {
      setSelectedStation(null);
    }

    if (!allowsPois && selectedPoi) {
      setSelectedPoi(null);
    }

    const selectedTypeAllowed =
      selectedDestinationType === 'none' || (selectedDestinationType === 'call' && allowsCalls) || (selectedDestinationType === 'station' && allowsStations) || (selectedDestinationType === 'poi' && allowsPois);

    if (!selectedTypeAllowed) {
      setSelectedDestinationType('none');
    }
  }, [detailLevel, selectedCall, selectedDestinationType, selectedPoi, selectedStation, selectedStatus, setSelectedCall, setSelectedDestinationType, setSelectedPoi, setSelectedStation]);

  React.useEffect(() => {
    if (!selectedStatus || selectedDestinationType !== 'none') {
      return;
    }

    if (selectedCall && statusDetailAllowsCalls(detailLevel)) {
      setSelectedDestinationType('call');
      return;
    }

    if (selectedStation && statusDetailAllowsStations(detailLevel)) {
      setSelectedDestinationType('station');
      return;
    }

    if (selectedPoi && statusDetailAllowsPois(detailLevel)) {
      setSelectedDestinationType('poi');
    }
  }, [detailLevel, selectedCall, selectedDestinationType, selectedPoi, selectedStation, selectedStatus, setSelectedDestinationType]);

  React.useEffect(() => {
    if (!isOpen || !selectedStatus || !statusDetailAllowsCalls(detailLevel) || !activeCallCandidate) {
      return;
    }

    if (selectedCall || selectedStation || selectedPoi || selectedDestinationType !== 'none') {
      return;
    }

    setSelectedCall(activeCallCandidate);
    setSelectedDestinationType('call');
    pendingScrollToCallIdRef.current = activeCallCandidate.CallId;

    // If the rows are already laid out no further onLayout will fire, so drive
    // the scroll ourselves once the current interactions settle.
    const interaction = InteractionManager.runAfterInteractions(flushPendingCallScroll);
    return () => interaction.cancel();
  }, [activeCallCandidate, detailLevel, flushPendingCallScroll, isOpen, selectedCall, selectedDestinationType, selectedPoi, selectedStation, selectedStatus, setSelectedCall, setSelectedDestinationType]);

  // Auto-pick the initial tab when the sheet opens or the status changes.
  // After that the user's manual tab taps must win — recomputing the preferred
  // tab on every selection change snaps the view back to the Calls tab.
  React.useEffect(() => {
    if (!isOpen || destinationTabs.length === 0) {
      return;
    }

    setSelectedTab(
      getPreferredDestinationTab({
        tabs: destinationTabs,
        selectedDestinationType,
        hasSelectedCall: !!selectedCall,
        hasSelectedStation: !!selectedStation,
        hasSelectedPoi: !!selectedPoi,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedStatus]);

  const getStatusDetailDescription = React.useCallback(
    (detail: number): string | null => {
      switch (detail) {
        case CustomStateDetailTypes.Stations:
          return t('status.station_destination_enabled');
        case CustomStateDetailTypes.Calls:
          return t('status.call_destination_enabled');
        case CustomStateDetailTypes.CallsAndStations:
          return t('status.both_destinations_enabled');
        case CustomStateDetailTypes.Pois:
          return t('status.poi_destination_enabled');
        case CustomStateDetailTypes.CallsAndPois:
          return t('status.calls_and_pois_destinations_enabled');
        case CustomStateDetailTypes.StationsAndPois:
          return t('status.stations_and_pois_destinations_enabled');
        case CustomStateDetailTypes.CallsStationsAndPois:
          return t('status.calls_stations_pois_destinations_enabled');
        default:
          return null;
      }
    },
    [t]
  );

  const handleClose = () => {
    reset();
  };

  const handleCallSelect = (callId: string) => {
    const call = availableCalls.find((item) => item.CallId === callId);
    if (!call) {
      return;
    }

    setSelectedCall(call);
    setSelectedStation(null);
    setSelectedPoi(null);
    setSelectedDestinationType('call');
  };

  const handleStationSelect = (stationId: string) => {
    const station = availableStations.find((item) => item.GroupId === stationId);
    if (!station) {
      return;
    }

    setSelectedStation(station);
    setSelectedCall(null);
    setSelectedPoi(null);
    setSelectedDestinationType('station');
  };

  const handlePoiSelect = (poiId: number) => {
    const poi = availablePois.find((item) => item.PoiId === poiId);
    if (!poi) {
      return;
    }

    setSelectedPoi(poi);
    setSelectedCall(null);
    setSelectedStation(null);
    setSelectedDestinationType('poi');
  };

  const handleNoDestinationSelect = () => {
    setSelectedDestinationType('none');
    setSelectedCall(null);
    setSelectedStation(null);
    setSelectedPoi(null);
  };

  const handleNext = () => {
    if (!canProceedFromCurrentStep()) {
      return;
    }

    if (currentStep === 'select-status') {
      if (detailLevel > 0) {
        setCurrentStep('select-destination');
        return;
      }

      if (noteType === 0) {
        void handleSubmit();
      } else {
        setCurrentStep('add-note');
      }

      return;
    }

    if (currentStep === 'select-destination') {
      if (noteType === 0) {
        void handleSubmit();
      } else {
        setCurrentStep('add-note');
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep === 'add-note') {
      if (detailLevel > 0) {
        setCurrentStep('select-destination');
      } else {
        setCurrentStep('select-status');
      }
      return;
    }

    if (currentStep === 'select-destination') {
      setCurrentStep('select-status');
    }
  };

  const handleStatusSelect = (statusId: string) => {
    const status = activeStatuses?.Statuses?.find((item) => item.Id.toString() === statusId);
    if (!status) {
      return;
    }

    setSelectedStatus(status);
  };

  const handleSubmit = React.useCallback(async () => {
    if (isSubmitting || !selectedStatus || !activeUnit) {
      return;
    }

    try {
      setIsSubmitting(true);

      const input = new SaveUnitStatusInput();
      input.Id = activeUnit.UnitId;
      input.Type = getStatusId();
      input.Note = note;
      input.RespondingTo = '0';
      input.RespondingToType = null;

      if (selectedDestinationType === 'call' && selectedCall) {
        input.RespondingTo = selectedCall.CallId;
        input.RespondingToType = DestinationEntityTypes.Call;
      } else if (selectedDestinationType === 'station' && selectedStation) {
        input.RespondingTo = selectedStation.GroupId;
        input.RespondingToType = DestinationEntityTypes.Station;
      } else if (selectedDestinationType === 'poi' && selectedPoi) {
        input.RespondingTo = selectedPoi.PoiId.toString();
        input.RespondingToType = DestinationEntityTypes.Poi;
      }

      // Take a fix at submission time rather than trusting whatever the watcher last left in the
      // store. The watcher only runs once a unit is selected and permission was granted, the store
      // is never persisted, and permission can be revoked from the OS at any point — so a cached
      // read is not evidence of anything. It is also the only honest way to enforce a status whose
      // custom-state definition sets GpsRequired: checking the cache would wave through a status
      // carrying coordinates from hours ago.
      const fix = await acquireLocationFix();

      if (fix.outcome !== 'acquired' && selectedStatus.Gps) {
        showToast('error', getLocationFixErrorMessage(fix.outcome));
        return;
      }

      // Read the latest GPS fix imperatively (no render subscription), preferring the fix we just
      // took and falling back to the watcher for a status that does not require one.
      const cached = useLocationStore.getState();
      const coords = fix.location?.coords ?? null;
      const latitude = coords?.latitude ?? cached.latitude;
      const longitude = coords?.longitude ?? cached.longitude;
      const accuracy = coords?.accuracy ?? cached.accuracy;
      const altitude = coords?.altitude ?? cached.altitude;
      const altitudeAccuracy = coords?.altitudeAccuracy ?? null;
      const speed = coords?.speed ?? cached.speed;
      const heading = coords?.heading ?? cached.heading;
      const timestamp = fix.location?.timestamp ?? cached.timestamp;

      if (latitude !== null && longitude !== null) {
        input.Latitude = latitude.toString();
        input.Longitude = longitude.toString();
        input.Accuracy = accuracy?.toString() || '0';
        input.Altitude = altitude?.toString() || '0';
        input.AltitudeAccuracy = altitudeAccuracy?.toString() || '';
        input.Speed = speed?.toString() || '0';
        input.Heading = heading?.toString() || '0';

        if (timestamp) {
          const locationDate = new Date(timestamp);
          input.Timestamp = locationDate.toISOString();
          input.TimestampUtc = locationDate.toUTCString().replace('UTC', 'GMT');
        }
      }

      input.Roles = unitRoleAssignments.map((assignment) => {
        const roleInput = new SaveUnitStatusRoleInput();
        roleInput.RoleId = assignment.UnitRoleId;
        roleInput.UserId = assignment.UserId;
        return roleInput;
      });

      if (selectedDestinationType === 'call' && selectedCall && activeCallId !== selectedCall.CallId) {
        setActiveCall(selectedCall.CallId);
      }

      await saveUnitStatus(input);
      showToast('success', t('status.status_saved_successfully'));
      reset();
    } catch (error) {
      logger.error({
        message: 'Failed to save unit status',
        context: { error },
      });
      showToast('error', t('status.failed_to_save_status'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeCallId,
    activeUnit,
    getStatusId,
    isSubmitting,
    note,
    reset,
    saveUnitStatus,
    selectedCall,
    selectedDestinationType,
    selectedPoi,
    selectedStation,
    selectedStatus,
    setActiveCall,
    showToast,
    t,
    unitRoleAssignments,
  ]);

  const shouldShowNoDestinationAsSelected = React.useMemo(() => {
    if (selectedCall || selectedStation || selectedPoi) {
      return false;
    }

    const shouldPreSelectActiveCall = isOpen && !!selectedStatus && statusDetailAllowsCalls(detailLevel) && !!activeCallId && (isLoading || !!activeCallCandidate);

    if (shouldPreSelectActiveCall) {
      return false;
    }

    return selectedDestinationType === 'none';
  }, [activeCallCandidate, activeCallId, detailLevel, isLoading, isOpen, selectedCall, selectedDestinationType, selectedPoi, selectedStation, selectedStatus]);

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select-status':
        return t('status.select_status');
      case 'select-destination':
        // A status with no destination options still lands here as a confirm step.
        return shouldShowDestinationStep ? t('status.select_destination', { status: selectedStatus?.Text }) : t('status.set_status');
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
        return cameFromStatusSelection ? 2 : 1;
      case 'add-note':
        if (cameFromStatusSelection) {
          return shouldShowDestinationStep ? 3 : 2;
        }

        return shouldShowDestinationStep ? 2 : 1;
      default:
        return 1;
    }
  };

  const getTotalSteps = () => {
    if (cameFromStatusSelection) {
      let totalSteps = 1;

      if (selectedStatus) {
        const hasDestinationSelection = getStatusProperty('Detail', 0) > 0;
        const currentNoteType = getStatusProperty('Note', 0);
        const hasNoteStep = currentNoteType > 0;

        if (hasDestinationSelection) {
          totalSteps += 1;
        }

        if (hasNoteStep) {
          totalSteps += 1;
        }
      } else if (activeStatuses?.Statuses && activeStatuses.Statuses.length > 0) {
        const hasAnyDestination = activeStatuses.Statuses.some((status) => Number(status.Detail) > 0);
        const hasAnyNote = activeStatuses.Statuses.some((status) => Number(status.Note) > 0);

        if (hasAnyDestination) {
          totalSteps += 1;
        }

        if (hasAnyNote) {
          totalSteps += 1;
        }
      } else {
        totalSteps = 3;
      }

      return totalSteps;
    }

    let totalSteps = 0;

    if (shouldShowDestinationStep) {
      totalSteps += 1;
    }

    if (isNoteRequired || isNoteOptional) {
      totalSteps += 1;
    }

    return Math.max(totalSteps, 1);
  };

  const canProceedFromCurrentStep = () => {
    if (isSubmitting) {
      return false;
    }

    switch (currentStep) {
      case 'select-status':
        return !!selectedStatus;
      case 'select-destination':
        return true;
      case 'add-note':
        return !isNoteRequired || note.trim().length > 0;
      default:
        return false;
    }
  };

  const getSelectedDestinationDisplay = () => {
    if (selectedCall) {
      return `${selectedCall.Number} - ${selectedCall.Name}`;
    }

    if (selectedStation) {
      return selectedStation.Name;
    }

    if (selectedPoi) {
      return getPoiSelectionLabel(selectedPoi, poiTypesById);
    }

    if (selectedDestinationType === 'call') {
      if (activeCallCandidate) {
        return `${activeCallCandidate.Number} - ${activeCallCandidate.Name}`;
      }

      if (isLoading || (!!activeCallId && availableCalls.length === 0)) {
        return t('calls.loading_calls');
      }
    }

    return t('status.no_destination');
  };

  // Opening straight into 'add-note' (status picked up front, no destination to choose)
  // leaves nothing to go back to, so the note step offers Cancel instead of Previous.
  const hasStepBeforeNote = cameFromStatusSelection || shouldShowDestinationStep;

  const shouldShowDestinationTabs = destinationTabs.length > 1;
  const showCalls = destinationTabs.includes('call') && (!shouldShowDestinationTabs || selectedTab === 'call');
  const showStations = destinationTabs.includes('station') && (!shouldShowDestinationTabs || selectedTab === 'station');
  const showPois = destinationTabs.includes('poi') && (!shouldShowDestinationTabs || selectedTab === 'poi');

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      {/* The sheet renders inside a native Modal, so keyboard-controller's window-bound
          avoidance never moves it — padding by the keyboard height reserves the covered
          strip instead. shrink on the column lets the step content compress into the
          remaining space so its scrollview actually scrolls rather than Yoga clipping it. */}
      <ActionsheetContent className="bg-white dark:bg-gray-900" style={{ paddingBottom: keyboardHeight }}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* flex-1 (not just shrink) so the column fills the snap-point-sized sheet:
            the step's list flexes into the space and the action buttons sit at the
            bottom instead of floating above a dead zone. */}
        <VStack space="md" className="w-full flex-1 p-4">
          <HStack space="sm" className="mb-2 justify-center">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.step')} {getStepNumber()} {t('common.of')} {getTotalSteps()}
            </Text>
          </HStack>

          <Heading size="lg" className="mb-4 text-center">
            {getStepTitle()}
          </Heading>

          {currentStep === 'select-status' ? (
            <VStack space="md" className="w-full flex-1">
              <Text className="mb-2 font-medium">{t('status.select_status_type')}</Text>

              <ScrollView className="flex-1">
                <VStack space="sm">
                  {activeStatuses?.Statuses && activeStatuses.Statuses.length > 0 ? (
                    activeStatuses.Statuses.map((status) => {
                      const statusDetailDescription = getStatusDetailDescription(Number(status.Detail));
                      const isSelected = selectedStatus?.Id.toString() === status.Id.toString();

                      return (
                        <TouchableOpacity
                          key={status.Id}
                          onPress={() => handleStatusSelect(status.Id.toString())}
                          className={`mb-3 rounded-lg border-2 p-3 ${isSelected ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}
                          style={{
                            backgroundColor: status.BColor || (isSelected ? '#dbeafe' : '#ffffff'),
                          }}
                        >
                          <HStack space="sm" className="items-center">
                            <Check size={20} color={isSelected ? '#3b82f6' : 'transparent'} />
                            <VStack className="flex-1">
                              <Text className="font-bold" style={{ color: invertColor(status.BColor || '#ffffff', true) }}>
                                {status.Text}
                              </Text>
                              {Number(status.Detail) > 0 ? <Text className="text-sm text-gray-600 dark:text-gray-400">{statusDetailDescription}</Text> : null}
                              {Number(status.Note) > 0 ? <Text className="text-xs text-gray-500 dark:text-gray-500">{Number(status.Note) === 1 ? t('status.note_optional') : t('status.note_required')}</Text> : null}
                            </VStack>
                          </HStack>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_statuses_available')}</Text>
                  )}
                </VStack>
              </ScrollView>

              <HStack space="xs" className="mt-2 justify-between px-4">
                <Button variant="outline" onPress={handleClose} className="px-3">
                  <ButtonText className="text-sm">{t('common.cancel')}</ButtonText>
                </Button>
                <Button onPress={handleNext} isDisabled={!canProceedFromCurrentStep()} className="bg-blue-600 px-4 py-2">
                  <ButtonText className="text-sm">{t('common.next')}</ButtonText>
                  <ArrowRight size={14} color="#fff" />
                </Button>
              </HStack>
            </VStack>
          ) : null}

          {currentStep === 'select-destination' && shouldShowDestinationStep ? (
            <VStack space="md" className="w-full flex-1">
              <Text className="mb-2 font-medium">{t('status.select_destination_type')}</Text>

              <TouchableOpacity
                onPress={handleNoDestinationSelect}
                className={`mb-4 rounded-lg border-2 p-3 ${shouldShowNoDestinationAsSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
              >
                <HStack space="sm" className="items-center">
                  <Check size={20} color={shouldShowNoDestinationAsSelected ? '#3b82f6' : 'transparent'} />
                  <VStack className="flex-1">
                    <Text className="font-bold">{t('status.no_destination')}</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400">{t('status.general_status')}</Text>
                  </VStack>
                </HStack>
              </TouchableOpacity>

              {shouldShowDestinationTabs ? (
                <HStack space="xs" className="mb-4">
                  {destinationTabs.map((tab) => (
                    <TouchableOpacity key={tab} onPress={() => setSelectedTab(tab)} className={`flex-1 rounded-lg py-3 ${selectedTab === tab ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      <Text className={`text-center font-semibold ${selectedTab === tab ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{t(getDestinationTabTranslationKey(tab))}</Text>
                    </TouchableOpacity>
                  ))}
                </HStack>
              ) : null}

              <ScrollView ref={destinationScrollRef} className="flex-1">
                {showCalls ? (
                  <VStack space="sm">
                    {isLoading ? (
                      <VStack space="md" className="w-full items-center justify-center">
                        <Spinner size="large" />
                        <Text className="text-center text-gray-600 dark:text-gray-400">{t('calls.loading_calls')}</Text>
                      </VStack>
                    ) : availableCalls.length > 0 ? (
                      availableCalls.map((call) => (
                        <TouchableOpacity
                          key={call.CallId}
                          onPress={() => handleCallSelect(call.CallId)}
                          onLayout={(event) => {
                            // Bring the auto-selected active call into view once
                            // its row reports where it landed in the list.
                            callRowOffsetsRef.current[call.CallId] = event.nativeEvent.layout.y;
                            if (pendingScrollToCallIdRef.current !== call.CallId) {
                              return;
                            }
                            pendingScrollToCallIdRef.current = null;
                            scrollDestinationToOffset(event.nativeEvent.layout.y);
                          }}
                          className={`mb-3 rounded-lg border-2 p-3 ${selectedCall?.CallId === call.CallId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                        >
                          <HStack space="sm" className="items-center">
                            <Check size={20} color={selectedCall?.CallId === call.CallId ? '#3b82f6' : 'transparent'} />
                            <VStack className="flex-1">
                              <Text className="font-bold">
                                {call.Number} - {call.Name}
                              </Text>
                              <Text className="text-sm text-gray-600 dark:text-gray-400">{call.Address}</Text>
                            </VStack>
                          </HStack>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('calls.no_calls_available')}</Text>
                    )}
                  </VStack>
                ) : null}

                {showStations ? (
                  <VStack space="sm">
                    {isLoading ? (
                      <VStack space="md" className="w-full items-center justify-center">
                        <Spinner size="large" />
                        <Text className="text-center text-gray-600 dark:text-gray-400">{t('status.loading_stations')}</Text>
                      </VStack>
                    ) : availableStations.length > 0 ? (
                      availableStations.map((station) => (
                        <TouchableOpacity
                          key={station.GroupId}
                          onPress={() => handleStationSelect(station.GroupId)}
                          className={`mb-3 rounded-lg border-2 p-3 ${selectedStation?.GroupId === station.GroupId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                        >
                          <HStack space="sm" className="items-center">
                            <Check size={20} color={selectedStation?.GroupId === station.GroupId ? '#3b82f6' : 'transparent'} />
                            <VStack className="flex-1">
                              <Text className="font-bold">{station.Name}</Text>
                              {station.Address ? <Text className="text-sm text-gray-600 dark:text-gray-400">{station.Address}</Text> : null}
                              {station.GroupType ? <Text className="text-xs text-gray-500 dark:text-gray-500">{station.GroupType}</Text> : null}
                            </VStack>
                          </HStack>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_stations_available')}</Text>
                    )}
                  </VStack>
                ) : null}

                {showPois ? (
                  <VStack space="sm">
                    {isLoading ? (
                      <VStack space="md" className="w-full items-center justify-center">
                        <Spinner size="large" />
                        <Text className="text-center text-gray-600 dark:text-gray-400">{t('status.loading_pois')}</Text>
                      </VStack>
                    ) : availablePois.length > 0 ? (
                      availablePois.map((poi) => {
                        const poiTypeName = poiTypesById[poi.PoiTypeId]?.Name || poi.PoiTypeName;
                        const poiSecondaryText = poi.Address || poi.Note || poiTypeName;

                        return (
                          <TouchableOpacity
                            key={poi.PoiId}
                            onPress={() => handlePoiSelect(poi.PoiId)}
                            className={`mb-3 rounded-lg border-2 p-3 ${selectedPoi?.PoiId === poi.PoiId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                          >
                            <HStack space="sm" className="items-center">
                              <Check size={20} color={selectedPoi?.PoiId === poi.PoiId ? '#3b82f6' : 'transparent'} />
                              <VStack className="flex-1">
                                <Text className="font-bold">{getPoiSelectionLabel(poi, poiTypesById)}</Text>
                                {poiSecondaryText ? <Text className="text-sm text-gray-600 dark:text-gray-400">{poiSecondaryText}</Text> : null}
                              </VStack>
                            </HStack>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text className="mt-4 italic text-gray-600 dark:text-gray-400">{t('status.no_pois_available')}</Text>
                    )}
                  </VStack>
                ) : null}
              </ScrollView>

              <HStack space="xs" className="mt-2 justify-between px-4">
                {cameFromStatusSelection ? (
                  <Button variant="outline" onPress={handlePrevious} className="px-3">
                    <ArrowLeft size={14} color="#737373" />
                    <ButtonText className="text-sm">{t('common.previous')}</ButtonText>
                  </Button>
                ) : (
                  <Button variant="outline" onPress={handleClose} className="px-3">
                    <ButtonText className="text-sm">{t('common.cancel')}</ButtonText>
                  </Button>
                )}
                <Button onPress={handleNext} isDisabled={!canProceedFromCurrentStep()} className="bg-blue-600 px-4 py-2">
                  <ButtonText className="text-sm">{t('common.next')}</ButtonText>
                  <ArrowRight size={14} color="#fff" />
                </Button>
              </HStack>
            </VStack>
          ) : null}

          {currentStep === 'select-destination' && !shouldShowDestinationStep ? (
            /* Same plain-ScrollView treatment as the add-note step below: the sheet's
               keyboard padding reserves the covered strip, and this scroll container
               lets the note field and buttons compress/scroll into it instead of
               being clipped by the fixed-height sheet. */
            <ScrollView
              ref={noteScrollRef}
              style={{ width: '100%', flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <VStack space="md" className="w-full">
                {isNoteRequired || isNoteOptional ? (
                  <>
                    <Text className="mb-2 font-medium">{t('status.add_note')}</Text>
                    <Textarea size="md" className="min-h-[100px] w-full">
                      <TextareaInput placeholder={isNoteRequired ? t('status.note_required') : t('status.note_optional')} value={note} onChangeText={setNote} />
                    </Textarea>
                  </>
                ) : null}
                <HStack space="xs" className="justify-between px-2">
                  {cameFromStatusSelection ? (
                    <Button variant="outline" onPress={handlePrevious} className="px-3">
                      <ArrowLeft size={14} color={colorScheme === 'dark' ? '#737373' : '#737373'} />
                      <ButtonText className="text-sm">{t('common.previous')}</ButtonText>
                    </Button>
                  ) : (
                    <Button variant="outline" onPress={handleClose} className="px-3">
                      <ButtonText className="text-sm">{t('common.cancel')}</ButtonText>
                    </Button>
                  )}
                  <Button onPress={() => void handleSubmit()} className="bg-blue-600 px-4 py-2" isDisabled={(isNoteRequired && !note.trim()) || isSubmitting}>
                    {isSubmitting ? <Spinner size="small" color="white" /> : null}
                    <ButtonText className="text-sm">{isSubmitting ? t('common.submitting') : t('common.submit')}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </ScrollView>
          ) : null}

          {currentStep === 'add-note' ? (
            /* Plain ScrollView on purpose: the sheet already slides above the keyboard via
               the ActionsheetContent paddingBottom. KeyboardAwareScrollView also reacts to
               the keyboard (its events are window-agnostic), so it compensated a second
               time and pushed the note field out of the sheet's visible area. */
            <ScrollView
              ref={noteScrollRef}
              style={{ width: '100%', flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <VStack space="md" className="w-full">
                <VStack space="sm">
                  <Text className="font-medium">{t('status.selected_status')}:</Text>
                  <VStack className="rounded-lg p-2" style={{ backgroundColor: selectedStatus?.BColor || '#f3f4f6' }}>
                    <Text className="font-bold" style={{ color: invertColor(selectedStatus?.BColor || '#f3f4f6', true) }}>
                      {selectedStatus?.Text}
                    </Text>
                  </VStack>
                </VStack>

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

                <HStack space="xs" className="justify-between px-2 pt-2">
                  {hasStepBeforeNote ? (
                    <Button variant="outline" onPress={handlePrevious} className="px-3" isDisabled={isSubmitting}>
                      <ArrowLeft size={14} color={colorScheme === 'dark' ? '#737373' : '#737373'} />
                      <ButtonText className="text-sm">{t('common.previous')}</ButtonText>
                    </Button>
                  ) : (
                    <Button variant="outline" onPress={handleClose} className="px-3" isDisabled={isSubmitting}>
                      <ButtonText className="text-sm">{t('common.cancel')}</ButtonText>
                    </Button>
                  )}
                  <Button onPress={() => void handleSubmit()} isDisabled={!canProceedFromCurrentStep() || isSubmitting} className="bg-blue-600 px-3">
                    {isSubmitting ? <Spinner size="small" color="white" /> : null}
                    <ButtonText className="text-sm">{isSubmitting ? t('common.submitting') : t('common.submit')}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </ScrollView>
          ) : null}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
