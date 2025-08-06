import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { useStatusBottomSheetStore, useStatusesStore } from '@/stores/status/store';
import { useCoreStore } from '@/stores/app/core-store';
import { useRolesStore } from '@/stores/roles/store';

import { StatusBottomSheet } from '../status-bottom-sheet';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('@/stores/status/store', () => ({
  useStatusBottomSheetStore: jest.fn(),
  useStatusesStore: jest.fn(),
}));


const mockSetActiveCall = jest.fn();

jest.mock('@/stores/app/core-store', () => {
  const mockStore = jest.fn();
  (mockStore as any).getState = jest.fn();
  return { useCoreStore: mockStore };
});

jest.mock('@/stores/roles/store', () => ({
  useRolesStore: jest.fn(),
}));

jest.mock('@/services/offline-event-manager.service', () => ({
  offlineEventManager: {
    initialize: jest.fn(),
  },
}));

// Mock the Actionsheet components
jest.mock('@/components/ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => {
    const { View } = require('react-native');
    return isOpen ? <View testID="actionsheet">{children}</View> : null;
  },
  ActionsheetBackdrop: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-backdrop">{children}</View>;
  },
  ActionsheetContent: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-content">{children}</View>;
  },
  ActionsheetDragIndicator: () => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator" />;
  },
  ActionsheetDragIndicatorWrapper: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator-wrapper">{children}</View>;
  },
}));

const mockTranslation = {
  t: (key: string, options?: any) => {
    const translations: Record<string, string> = {
      'common.step': 'Step',
      'common.of': 'of',
      'common.next': 'Next',
      'common.previous': 'Previous',
      'common.submit': 'Submit',
      'common.optional': 'Optional',
      'status.select_destination': 'Select Destination for {{status}}',
      'status.add_note': 'Add Note',
      'status.set_status': 'Set Status',
      'status.select_destination_type': 'Select destination type',
      'status.no_destination': 'No Destination',
      'status.general_status': 'General Status',
      'status.calls_tab': 'Calls',
      'status.stations_tab': 'Stations',
      'status.selected_destination': 'Selected Destination',
      'status.note': 'Note',
      'status.note_required': 'Note required',
      'status.note_optional': 'Note optional',
      'status.loading_stations': 'Loading stations...',
      'calls.loading_calls': 'Loading calls...',
      'calls.no_calls_available': 'No calls available',
      'status.no_stations_available': 'No stations available',
    };

    let translation = translations[key] || key;
    if (options && typeof options === 'object') {
      Object.keys(options).forEach(optionKey => {
        translation = translation.replace(`{{${optionKey}}}`, options[optionKey]);
      });
    }
    return translation;
  },
};

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseStatusBottomSheetStore = useStatusBottomSheetStore as jest.MockedFunction<typeof useStatusBottomSheetStore>;
const mockUseStatusesStore = useStatusesStore as jest.MockedFunction<typeof useStatusesStore>;
const mockUseCoreStore = useCoreStore as unknown as jest.MockedFunction<any>;
const mockGetState = (mockUseCoreStore as any).getState;
const mockUseRolesStore = useRolesStore as jest.MockedFunction<typeof useRolesStore>;

describe('StatusBottomSheet', () => {
  const mockReset = jest.fn();
  const mockSetCurrentStep = jest.fn();
  const mockSetSelectedCall = jest.fn();
  const mockSetSelectedStation = jest.fn();
  const mockSetSelectedDestinationType = jest.fn();
  const mockSetNote = jest.fn();
  const mockFetchDestinationData = jest.fn();
  const mockSaveUnitStatus = jest.fn();

  const defaultBottomSheetStore = {
    isOpen: false,
    currentStep: 'select-destination' as const,
    selectedCall: null,
    selectedStation: null,
    selectedDestinationType: 'none' as const,
    selectedStatus: null,
    note: '',
    availableCalls: [],
    availableStations: [],
    isLoading: false,
    setIsOpen: jest.fn(),
    setCurrentStep: mockSetCurrentStep,
    setSelectedCall: mockSetSelectedCall,
    setSelectedStation: mockSetSelectedStation,
    setSelectedDestinationType: mockSetSelectedDestinationType,
    setNote: mockSetNote,
    fetchDestinationData: mockFetchDestinationData,
    reset: mockReset,
  };

  const defaultStatusesStore = {
    isLoading: false,
    error: null,
    saveUnitStatus: mockSaveUnitStatus,
  };

  const defaultCoreStore = {
    activeUnitId: 'unit-1',
    activeUnit: {
      UnitId: 'unit-1',
      Name: 'Unit 1',
    },
    activeUnitStatus: null,
    activeUnitStatusType: null,
    activeStatuses: null,
    activeCallId: null,
    activeCall: null,
    activePriority: null,
    config: null,
    isLoading: false,
    isInitialized: true,
    isInitializing: false,
    error: null,
    init: jest.fn(),
    setActiveUnit: jest.fn(),
    setActiveUnitWithFetch: jest.fn(),
    setActiveCall: mockSetActiveCall,
    fetchConfig: jest.fn(),
  };

  const defaultRolesStore = {
    unitRoleAssignments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue(mockTranslation as any);
    mockUseStatusBottomSheetStore.mockReturnValue(defaultBottomSheetStore);
    mockUseStatusesStore.mockReturnValue(defaultStatusesStore);

    // Set up the core store mock with getState that returns the store state
    mockGetState.mockReturnValue(defaultCoreStore as any);
    // Also mock the hook usage in the component  
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(defaultCoreStore);
      }
      return defaultCoreStore;
    });
    mockUseRolesStore.mockReturnValue(defaultRolesStore);
  });

  it('should be importable without error', () => {
    expect(StatusBottomSheet).toBeDefined();
    expect(typeof StatusBottomSheet).toBe('function');
  });

  it('should not render when isOpen is false', () => {
    render(<StatusBottomSheet />);
    expect(screen.queryByText('Select Destination for')).toBeNull();
  });

  it('should render when isOpen is true with destination step', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1, // Show destination step
      Note: 0, // No note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByText('Select Destination for Available')).toBeTruthy();
    expect(screen.getByText('No Destination')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('should handle no destination selection', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    const noDestinationOption = screen.getByText('No Destination');
    fireEvent.press(noDestinationOption);

    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('none');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should handle call selection and unselect no destination', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should handle station selection and unselect no destination', () => {
    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1, // Show stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableStations: [mockStation],
    });

    render(<StatusBottomSheet />);

    const stationOption = screen.getByText('Fire Station 1');
    fireEvent.press(stationOption);

    expect(mockSetSelectedStation).toHaveBeenCalledWith(mockStation);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('station');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
  });

  it('should set active call when selecting a call that is not already active', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with no active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: null,
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: null,
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetActiveCall).toHaveBeenCalledWith('call-1');
  });

  it('should set active call when selecting a different call than currently active', () => {
    const mockCall = {
      CallId: 'call-2',
      Number: 'C002',
      Name: 'Fire Emergency',
      Address: '456 Oak St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with different active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C002 - Fire Emergency');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetActiveCall).toHaveBeenCalledWith('call-2');
  });

  it('should not set active call when selecting the same call that is already active', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with same active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetActiveCall).not.toHaveBeenCalled();
  });

  it('should show tabs when detailLevel is 3', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Show both calls and stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [{ CallId: 'call-1', Number: 'C001', Name: 'Call', Address: '' }],
      availableStations: [{ GroupId: 'station-1', Name: 'Station 1', Address: '', GroupType: 'Station' }],
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Calls')).toBeTruthy();
    expect(screen.getByText('Stations')).toBeTruthy();
  });

  it('should proceed to note step when next is pressed', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1, // Note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');
    fireEvent.press(nextButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('add-note');
  });

  it('should show note step correctly', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1, // Note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
    expect(screen.getByText('Add Note')).toBeTruthy();
    expect(screen.getByText('Selected Destination:')).toBeTruthy();
    expect(screen.getByText('No Destination')).toBeTruthy();
    expect(screen.getByText('Previous')).toBeTruthy();
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('should handle previous button on note step', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
    });

    render(<StatusBottomSheet />);

    const previousButton = screen.getByText('Previous');
    fireEvent.press(previousButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('select-destination');
  });

  it('should handle note input', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
    });

    render(<StatusBottomSheet />);

    const noteInput = screen.getByPlaceholderText('Note required');
    fireEvent.changeText(noteInput, 'Test note');

    expect(mockSetNote).toHaveBeenCalledWith('Test note');
  });

  it('should disable submit when note is required but empty', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1, // Note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
      note: '', // Empty note
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
  });

  it('should enable submit when note is required and provided', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1, // Note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
      note: 'Test note', // Note provided
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton.props.accessibilityState.disabled).toBe(false);
  });

  it('should submit status directly when no destination step needed and no note required', async () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 0, // No destination step
      Note: 0, // No note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
    });
  });

  it('should show loading states correctly', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Need at least one call in availableCalls for the parent VStack to render
    const mockAvailableCalls = [
      { CallId: 'call-1', Name: 'Test Call', Number: '123', Address: 'Test Address' },
    ];

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'select-destination',
      isLoading: true, // This should show loading instead of the call list
      availableCalls: mockAvailableCalls,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Loading calls...')).toBeTruthy();
  });

  it('should fetch destination data when opened', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    expect(mockFetchDestinationData).toHaveBeenCalledWith('unit-1');
  });

  it('should show custom checkbox for no destination when selected', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // The No Destination option should be visually selected
    const noDestinationContainer = screen.getByText('No Destination').parent?.parent;
    expect(noDestinationContainer).toBeTruthy();
  });

  it('should show custom checkbox for selected call', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    const callContainer = screen.getByText('C001 - Emergency Call').parent?.parent;
    expect(callContainer).toBeTruthy();
  });

  it('should show custom checkbox for selected station', () => {
    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableStations: [mockStation],
      selectedStation: mockStation,
      selectedDestinationType: 'station',
    });

    render(<StatusBottomSheet />);

    const stationContainer = screen.getByText('Fire Station 1').parent?.parent;
    expect(stationContainer).toBeTruthy();
  });

  it('should clear call selection when no destination is selected', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    // Select no destination - should clear call selection
    const noDestinationOption = screen.getByText('No Destination');
    fireEvent.press(noDestinationOption);

    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('none');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should clear station selection when call is selected', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Both calls and stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      availableStations: [mockStation],
      selectedStation: mockStation,
      selectedDestinationType: 'station',
    });

    render(<StatusBottomSheet />);

    // Select call - should clear station selection
    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should clear call selection when station is selected', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Both calls and stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      availableStations: [mockStation],
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    // Switch to stations tab first
    const stationsTab = screen.getByText('Stations');
    fireEvent.press(stationsTab);

    // Select station - should clear call selection
    const stationOption = screen.getByText('Fire Station 1');
    fireEvent.press(stationOption);

    expect(mockSetSelectedStation).toHaveBeenCalledWith(mockStation);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('station');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
  });

  it('should render many items without height constraints for proper scrolling', () => {
    // Create many mock calls to test scrolling
    const manyCalls = Array.from({ length: 10 }, (_, index) => ({
      CallId: `call-${index + 1}`,
      Number: `C${String(index + 1).padStart(3, '0')}`,
      Name: `Emergency Call ${index + 1}`,
      Address: `${100 + index} Main Street`,
    }));

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: manyCalls,
    });

    render(<StatusBottomSheet />);

    // All calls should be rendered (not limited by height constraints)
    expect(screen.getByText('C001 - Emergency Call 1')).toBeTruthy();
    expect(screen.getByText('C005 - Emergency Call 5')).toBeTruthy();
    expect(screen.getByText('C010 - Emergency Call 10')).toBeTruthy();

    // Select a call in the middle to ensure it's interactive
    const fifthCall = screen.getByText('C005 - Emergency Call 5');
    fireEvent.press(fifthCall);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(manyCalls[4]);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
  });

  it('should render many stations without height constraints for proper scrolling', () => {
    // Create many mock stations to test scrolling
    const manyStations = Array.from({ length: 8 }, (_, index) => ({
      GroupId: `station-${index + 1}`,
      Name: `Fire Station ${index + 1}`,
      Address: `${200 + index} Oak Avenue`,
      GroupType: 'Station',
    }));

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1, // Show stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableStations: manyStations,
    });

    render(<StatusBottomSheet />);

    // All stations should be rendered (not limited by height constraints)
    expect(screen.getByText('Fire Station 1')).toBeTruthy();
    expect(screen.getByText('Fire Station 4')).toBeTruthy();
    expect(screen.getByText('Fire Station 8')).toBeTruthy();

    // Select a station in the middle to ensure it's interactive
    const fourthStation = screen.getByText('Fire Station 4');
    fireEvent.press(fourthStation);

    expect(mockSetSelectedStation).toHaveBeenCalledWith(manyStations[3]);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('station');
  });

  it('should pre-select active call when status bottom sheet opens with calls enabled', async () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const otherCall = {
      CallId: 'other-call-456',
      Number: 'C456',
      Name: 'Other Emergency Call',
      Address: '456 Other St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    };
    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [otherCall, activeCall], // Active call is in the list
      isLoading: false,
      selectedCall: null, // No call initially selected
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should pre-select the active call
    await waitFor(() => {
      expect(mockSetSelectedCall).toHaveBeenCalledWith(activeCall);
      expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    });
  });

  it('should pre-select active call when status has detailLevel 3 (both calls and stations)', async () => {
    const activeCall = {
      CallId: 'active-call-789',
      Number: 'C789',
      Name: 'Active Fire Call',
      Address: '789 Fire St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Show both calls and stations
      Note: 0,
    };

    // Mock core store with active call
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'active-call-789',
    };
    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      availableStations: [{ GroupId: 'station-1', Name: 'Station 1', Address: '', GroupType: 'Station' }],
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should pre-select the active call
    await waitFor(() => {
      expect(mockSetSelectedCall).toHaveBeenCalledWith(activeCall);
      expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    });
  });

  it('should not pre-select active call when calls are not enabled (detailLevel 1)', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1, // Show only stations, not calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall], // Active call is in the list but not relevant for this status
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select the active call since this status doesn't support calls
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalledWith('call');
  });

  it('should not pre-select active call when it is not in the available calls list', () => {
    const availableCall = {
      CallId: 'available-call-456',
      Number: 'C456',
      Name: 'Available Call',
      Address: '456 Available St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call that's NOT in the available calls list
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'different-active-call-999',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [availableCall], // Active call is NOT in this list
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select any call since the active call is not available
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalledWith('call');
  });

  it('should not pre-select active call when there is no active call', () => {
    const availableCall = {
      CallId: 'available-call-456',
      Number: 'C456',
      Name: 'Available Call',
      Address: '456 Available St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with NO active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: null,
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [availableCall],
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select any call since there's no active call
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalledWith('call');
  });

  it('should not pre-select active call when a call is already selected', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const alreadySelectedCall = {
      CallId: 'selected-call-456',
      Number: 'C456',
      Name: 'Already Selected Call',
      Address: '456 Selected St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall, alreadySelectedCall],
      isLoading: false,
      selectedCall: alreadySelectedCall, // Already has a selected call
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    // Should NOT change the selection since a call is already selected
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalled();
  });

  it('should not pre-select active call when destination type is not none', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'station', // Not 'none', so should not change selection
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select the active call since destination type is already set to station
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalled();
  });

  it('should not pre-select active call when still loading', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      isLoading: true, // Still loading
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select the active call since it's still loading
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalled();
  });
});