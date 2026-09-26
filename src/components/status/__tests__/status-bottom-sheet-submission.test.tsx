// Submission lifecycle of the root-mounted status sheet, driven through the real status stores so a
// request can outlive the sheet that started it — the path that left crews unable to submit a
// second status without force-closing the app.
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/use-keyboard-height', () => ({ useKeyboardHeight: () => 0 }));

// Mirrors how gluestack dismisses: the backdrop only when closeOnOverlayClick allows it, Android back
// always (the sheet consumes the press), and the swipe handle only while it can receive touches.
jest.mock('@/components/ui/actionsheet', () => {
  const mockReact = require('react');
  const { Pressable, View } = require('react-native');
  const MockContext = mockReact.createContext({ onClose: () => {}, closeOnOverlayClick: true });

  return {
    Actionsheet: ({ children, isOpen, onClose, closeOnOverlayClick = true }: any) =>
      isOpen
        ? mockReact.createElement(
            MockContext.Provider,
            { value: { onClose, closeOnOverlayClick } },
            mockReact.createElement(View, { testID: 'actionsheet' }, children, mockReact.createElement(Pressable, { testID: 'hardware-back', onPress: onClose }))
          )
        : null,
    ActionsheetBackdrop: () => {
      const { onClose, closeOnOverlayClick } = mockReact.useContext(MockContext);
      return mockReact.createElement(Pressable, { testID: 'backdrop', onPress: () => (closeOnOverlayClick ? onClose() : undefined) });
    },
    ActionsheetContent: ({ children }: any) => mockReact.createElement(View, null, children),
    ActionsheetDragIndicator: () => null,
    ActionsheetDragIndicatorWrapper: ({ children, pointerEvents }: any) => {
      const { onClose } = mockReact.useContext(MockContext);
      return mockReact.createElement(Pressable, { testID: 'drag-handle', pointerEvents, onPress: () => (pointerEvents === 'none' ? undefined : onClose()) }, children);
    },
  };
});

jest.mock('../../ui/button', () => {
  const mockReact = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ children, onPress, isDisabled }: any) => mockReact.createElement(TouchableOpacity, { onPress: isDisabled ? undefined : onPress, accessibilityState: { disabled: !!isDisabled } }, children),
    ButtonText: ({ children }: any) => mockReact.createElement(Text, null, children),
  };
});
jest.mock('../../ui/heading', () => ({ Heading: ({ children }: any) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('../../ui/hstack', () => ({ HStack: ({ children }: any) => require('react').createElement(require('react-native').View, null, children) }));
jest.mock('../../ui/vstack', () => ({ VStack: ({ children }: any) => require('react').createElement(require('react-native').View, null, children) }));
jest.mock('../../ui/text', () => ({ Text: ({ children, testID }: any) => require('react').createElement(require('react-native').Text, { testID }, children) }));
jest.mock('../../ui/spinner', () => ({ Spinner: () => require('react').createElement(require('react-native').View, { testID: 'spinner' }) }));
jest.mock('../../ui/textarea', () => ({
  Textarea: ({ children }: any) => require('react').createElement(require('react-native').View, null, children),
  TextareaInput: (props: any) => require('react').createElement(require('react-native').TextInput, props),
}));
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }), styled: (component: any) => component, cssInterop: (component: any) => component }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/lib/utils', () => ({ invertColor: () => '#000000' }));
jest.mock('@/lib/logging', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

jest.mock('@/services/location-fix', () => ({
  acquireLocationFix: jest.fn(async () => ({
    outcome: 'acquired',
    location: { coords: { latitude: 40.7128, longitude: -74.006, accuracy: 5, altitude: 10, altitudeAccuracy: 3, speed: 0, heading: 0 }, timestamp: 1700000000000 },
  })),
  getLocationFixErrorMessage: jest.fn(() => 'fix-error'),
  readRecentLocation: jest.fn(async () => null),
}));
jest.mock('@/services/offline-event-manager.service', () => ({
  offlineEventManager: {
    initialize: jest.fn(),
    queueUnitStatusEvent: jest.fn(() => 'queued-event'),
    isDeviceOffline: jest.fn(() => false),
    hasUndeliveredUnitStatuses: jest.fn(() => false),
    deliverQueuedUnitStatuses: jest.fn(async () => true),
  },
}));
jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: { getState: () => ({ latitude: null, longitude: null, accuracy: null, altitude: null, speed: null, heading: null, timestamp: null }) },
}));
jest.mock('@/stores/roles/store', () => ({ useRolesStore: (selector: any) => selector({ unitRoleAssignments: [] }) }));
jest.mock('@/stores/calls/store', () => ({ useCallsStore: { setState: jest.fn(), getState: () => ({}) } }));

const mockShowToast = jest.fn();
jest.mock('@/stores/toast/store', () => ({ useToastStore: (selector: any) => selector({ showToast: mockShowToast }) }));

jest.mock('@/api/dispatch/dispatch', () => ({ getSetUnitStatusData: jest.fn() }));
jest.mock('@/api/units/unitStatuses', () => ({ saveUnitStatus: jest.fn() }));

jest.mock('@/stores/app/core-store', () => {
  const { create } = require('zustand');
  const useCoreStore = create(() => ({
    activeUnit: { UnitId: 'unit-1', Name: 'Engine 1' },
    activeUnitStatus: null,
    activeCallId: null,
    setActiveCall: jest.fn(),
    setActiveUnitWithFetch: jest.fn(() => Promise.resolve()),
    activeStatuses: {
      UnitType: '0',
      Statuses: [
        { Id: 1, Text: 'Available', BColor: '#28a745', Gps: false, Note: 0, Detail: 0 },
        { Id: 2, Text: 'Responding', BColor: '#ffc107', Gps: false, Note: 0, Detail: 0 },
        { Id: 3, Text: 'On Scene', BColor: '#dc3545', Gps: true, Note: 0, Detail: 0 },
      ],
    },
  }));
  return { useCoreStore };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { acquireLocationFix, readRecentLocation } from '@/services/location-fix';
import { useCoreStore } from '@/stores/app/core-store';
import { useStatusBottomSheetStore } from '@/stores/status/store';

import { StatusBottomSheet } from '../status-bottom-sheet';

const mockSaveUnitStatus = saveUnitStatus as jest.Mock;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const statusById = (id: number) => (useCoreStore.getState() as any).activeStatuses.Statuses.find((status: { Id: number }) => status.Id === id);

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const openWith = async (statusId: number) => {
  act(() => useStatusBottomSheetStore.getState().setIsOpen(true, statusById(statusId)));
  await flush();
};

const pressSubmit = async () => {
  await act(async () => {
    fireEvent.press(screen.getByText('common.submit'));
  });
  await flush();
};

describe('StatusBottomSheet submission lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStatusBottomSheetStore.getState().reset();
    (getSetUnitStatusData as jest.Mock).mockResolvedValue({ Data: { Calls: [], Stations: [], DestinationPois: [], PoiTypes: [] } });
    mockSaveUnitStatus.mockResolvedValue({});
  });

  it('submits two statuses back to back', async () => {
    const { unmount } = render(<StatusBottomSheet />);

    await openWith(1);
    await pressSubmit();
    expect(useStatusBottomSheetStore.getState().isOpen).toBe(false);

    await openWith(2);
    await pressSubmit();

    expect(mockSaveUnitStatus).toHaveBeenCalledTimes(2);
    expect(mockSaveUnitStatus).toHaveBeenNthCalledWith(1, expect.objectContaining({ Type: '1' }));
    expect(mockSaveUnitStatus).toHaveBeenNthCalledWith(2, expect.objectContaining({ Type: '2' }));
    expect(mockShowToast).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('cannot be dismissed while a submission is in flight', async () => {
    const save = deferred<unknown>();
    mockSaveUnitStatus.mockReturnValueOnce(save.promise);
    const { unmount } = render(<StatusBottomSheet />);

    await openWith(1);
    await pressSubmit();
    expect(screen.getByText('common.submitting')).toBeTruthy();

    // Backdrop tap, Android back, and a swipe on the handle.
    fireEvent.press(screen.getByTestId('backdrop'));
    fireEvent.press(screen.getByTestId('hardware-back'));
    fireEvent.press(screen.getByTestId('drag-handle'));
    await flush();

    expect(screen.getByTestId('drag-handle').props.pointerEvents).toBe('none');
    expect(useStatusBottomSheetStore.getState().isOpen).toBe(true);
    expect(useStatusBottomSheetStore.getState().selectedStatus?.Id).toBe(1);

    await act(async () => {
      save.resolve({});
    });
    await flush();

    expect(useStatusBottomSheetStore.getState().isOpen).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith('success', 'status.status_saved_successfully');
    unmount();
  });

  it('can be dismissed again once the submission settles', async () => {
    mockSaveUnitStatus.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 500'), { isAxiosError: true, response: { status: 500 } }));
    const { unmount } = render(<StatusBottomSheet />);

    await openWith(1);
    await pressSubmit();

    expect(mockShowToast).toHaveBeenCalledWith('error', 'status.failed_to_save_status');
    expect(useStatusBottomSheetStore.getState().isOpen).toBe(true);
    expect(screen.getByTestId('drag-handle').props.pointerEvents).toBe('auto');

    fireEvent.press(screen.getByTestId('backdrop'));
    await flush();

    expect(useStatusBottomSheetStore.getState().isOpen).toBe(false);
    unmount();
  });

  it('does not let a request from a closed sheet block or close the next one', async () => {
    const firstSave = deferred<unknown>();
    const secondSave = deferred<unknown>();
    mockSaveUnitStatus.mockReturnValueOnce(firstSave.promise).mockReturnValueOnce(secondSave.promise);
    const { unmount } = render(<StatusBottomSheet />);

    await openWith(1);
    await pressSubmit();

    // Closed from outside the sheet (e.g. the app resetting state) while the save is in flight.
    act(() => useStatusBottomSheetStore.getState().reset());
    await flush();

    await openWith(2);
    expect(screen.queryByText('common.submitting')).toBeNull();

    await pressSubmit();
    expect(mockSaveUnitStatus).toHaveBeenCalledTimes(2);

    // The first request lands while the second sheet is still waiting on its own.
    await act(async () => {
      firstSave.resolve({});
    });
    await flush();

    expect(useStatusBottomSheetStore.getState().isOpen).toBe(true);
    expect(useStatusBottomSheetStore.getState().selectedStatus?.Id).toBe(2);
    expect(mockShowToast).not.toHaveBeenCalled();

    await act(async () => {
      secondSave.resolve({});
    });
    await flush();

    expect(useStatusBottomSheetStore.getState().isOpen).toBe(false);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('success', 'status.status_saved_successfully');
    unmount();
  });

  it('tells the crew the status is queued when it could not be sent yet', async () => {
    mockSaveUnitStatus.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK', request: {} }));
    const { unmount } = render(<StatusBottomSheet />);

    await openWith(1);
    await pressSubmit();

    expect(mockShowToast).toHaveBeenCalledWith('warning', 'status.status_queued');
    expect(mockShowToast).not.toHaveBeenCalledWith('success', expect.anything());
    expect(useStatusBottomSheetStore.getState().isOpen).toBe(false);
    unmount();
  });

  it('only waits on a live GPS fix for a status that requires one', async () => {
    const { unmount } = render(<StatusBottomSheet />);

    await openWith(1);
    await pressSubmit();
    expect(acquireLocationFix).not.toHaveBeenCalled();
    expect(readRecentLocation).toHaveBeenCalledTimes(1);

    await openWith(3);
    await pressSubmit();
    expect(acquireLocationFix).toHaveBeenCalledTimes(1);
    expect(mockSaveUnitStatus).toHaveBeenLastCalledWith(expect.objectContaining({ Type: '3', Latitude: '40.7128', Longitude: '-74.006' }));
    unmount();
  });
});
