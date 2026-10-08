import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders } from 'axios';
import React from 'react';

import { getNewCallFieldPolicy } from '@/api/calls/newCallFieldPolicy';

import EditCall from '../[id]/edit';

// --- state the mocked stores read --------------------------------------------------------------

const mockUpdateCall = jest.fn();
const mockToast = { show: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };

const BASE_CALL = {
  CallId: '42',
  Name: 'Structure fire',
  Nature: 'Smoke showing',
  Note: 'Stored note',
  Address: '1 Main St',
  Geolocation: '40.1,-70.2',
  Latitude: '40.1',
  Longitude: '-70.2',
  What3Words: '',
  ContactName: '',
  ContactInfo: 'Stored info',
  ExternalId: 'CAD-1',
  IncidentId: '',
  ReferenceId: 'R-9',
  DestinationPoiId: 7,
  Priority: 1,
  Type: 'Fire',
  State: 0,
};

const mockDetailState: any = {
  call: BASE_CALL,
  callExtraData: { Dispatches: [{ Id: 'u1', Type: 'Personnel' }] },
  isLoading: false,
  error: null,
  fetchCallDetail: jest.fn(),
  updateCall: (...args: unknown[]) => mockUpdateCall(...args),
};

// Stable references: the form re-seeds itself whenever these change.
const mockCallsState = {
  callPriorities: [{ Id: 1, Name: 'High' }],
  callTypes: [{ Id: '1', Name: 'Fire' }],
  destinationPois: [],
  poiTypes: [],
  isLoading: false,
  error: null,
  fetchCallFormData: jest.fn(),
};

// --- module mocks ------------------------------------------------------------------------------

jest.mock('@/api/calls/newCallFieldPolicy', () => ({ getNewCallFieldPolicy: jest.fn() }));

jest.mock('@/stores/calls/detail-store', () => {
  const useCallDetailStore: any = (selector: (state: any) => unknown) => selector(mockDetailState);
  useCallDetailStore.getState = () => mockDetailState;
  return { useCallDetailStore };
});

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: any) => unknown) => selector(mockCallsState),
}));

jest.mock('@/hooks/use-toast', () => ({ useToast: () => mockToast }));
jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

jest.mock('@/hooks/use-call-location-search', () => ({
  useCallLocationSearch: () => ({
    isGeocodingAddress: false,
    isGeocodingCoordinates: false,
    isGeocodingWhat3Words: false,
    isGeocodingPlusCode: false,
    addressResults: [],
    isAddressSelectionOpen: false,
    closeAddressSelection: jest.fn(),
    selectAddressResult: jest.fn(),
    searchAddress: jest.fn(),
    searchCoordinates: jest.fn(),
    searchWhat3Words: jest.fn(),
    searchPlusCode: jest.fn(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { fields?: string }) => (options?.fields !== undefined ? `${key}|${options.fields}` : key),
  }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: '42' }),
}));

jest.mock('@/components/common/header-back-button', () => ({ HeaderBackButton: () => null }));
jest.mock('@/components/common/loading', () => ({ Loading: () => null }));
jest.mock('@/components/maps/full-screen-location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/maps/location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/calls/dispatch-selection-modal', () => ({ DispatchSelectionModal: () => null }));
jest.mock('@/components/common/date-time-field', () => ({
  DateTimeField: ({ value, onChange, testID, clearable = true }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput testID={testID} value={value} onChangeText={onChange} accessibilityHint={clearable ? 'clearable' : 'not-clearable'} />;
  },
}));
jest.mock('@/components/ui/lucide-icons', () => ({ ChevronDownIcon: () => null }));

jest.mock('@/components/calls/destination-poi-selector', () => ({
  DestinationPoiSelector: ({ isRequired }: { isRequired?: boolean }) => {
    const { Text } = require('react-native');
    return <Text testID="destination-poi-selector">{isRequired ? 'destination*' : 'destination'}</Text>;
  },
}));

jest.mock('@/components/calls/call-location-fields', () => ({
  CallAddressSelectionSheet: () => null,
  CallLocationSearchField: ({ label, isRequired, testIDPrefix, value, onChangeText }: any) => {
    const { TextInput, View, Text } = require('react-native');
    return (
      <View testID={isRequired ? 'required-field' : 'field'}>
        <Text>{label}</Text>
        <TextInput testID={`${testIDPrefix}-input`} value={value} onChangeText={onChangeText} />
      </View>
    );
  },
}));

jest.mock('@/components/ui/form-control', () => {
  const { View, Text } = require('react-native');
  return {
    FormControl: ({ children, isRequired }: any) => <View testID={isRequired ? 'required-field' : 'field'}>{children}</View>,
    FormControlLabel: ({ children }: any) => <View>{children}</View>,
    FormControlLabelText: ({ children }: any) => <Text>{children}</Text>,
    FormControlError: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@/components/ui/input', () => {
  const { View, TextInput } = require('react-native');
  return {
    Input: ({ children }: any) => <View>{children}</View>,
    InputField: ({ testID, placeholder, value, onChangeText }: any) => <TextInput testID={testID ?? placeholder} value={value} onChangeText={onChangeText} />,
  };
});

jest.mock('@/components/ui/textarea', () => {
  const { View, TextInput } = require('react-native');
  return {
    Textarea: ({ children }: any) => <View>{children}</View>,
    TextareaInput: ({ testID, placeholder, value, onChangeText }: any) => <TextInput testID={testID ?? placeholder} value={value} onChangeText={onChangeText} />,
  };
});

jest.mock('@/components/ui/select', () => {
  const { View } = require('react-native');
  const Pass = ({ children }: any) => <View>{children}</View>;
  return { Select: Pass, SelectBackdrop: () => null, SelectContent: Pass, SelectIcon: () => null, SelectInput: () => null, SelectItem: () => null, SelectPortal: Pass, SelectTrigger: Pass };
});

jest.mock('@/components/ui/button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ children, onPress, isDisabled, disabled, testID }: any) => (
      <Pressable testID={testID} onPress={onPress} disabled={!!(isDisabled || disabled)}>
        {children}
      </Pressable>
    ),
    ButtonText: ({ children }: any) => <Text>{children}</Text>,
    ButtonSpinner: () => null,
  };
});

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children }: any) => <View>{children}</View> };
});

jest.mock('@/components/ui/card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: any) => <View>{children}</View> };
});

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text: ({ children }: any) => <Text>{children}</Text> };
});

// --- helpers -----------------------------------------------------------------------------------

const mockedGetPolicy = getNewCallFieldPolicy as jest.Mock;

const renderWithPolicy = async (rules: { Key: string; Visible: boolean; Required: boolean }[]) => {
  mockedGetPolicy.mockResolvedValue({ Rules: rules });
  render(<EditCall />);
  // The save button stays disabled until the policy lands.
  await waitFor(() => expect(screen.getByTestId('save-call-button')).not.toBeDisabled());
};

const save = () => fireEvent.press(screen.getByTestId('save-call-button'));

const isMarkedRequired = (label: string) => screen.getAllByTestId('required-field').some((field) => within(field).queryByText(label) !== null);

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

describe('EditCall field policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetailState.call = BASE_CALL;
    mockDetailState.callExtraData = { Dispatches: [{ Id: 'u1', Type: 'Personnel' }] };
    mockUpdateCall.mockResolvedValue(undefined);
  });

  it('offers every field the new-call form offers when nothing is hidden', async () => {
    await renderWithPolicy([]);

    expect(screen.getByTestId('note-input')).toBeTruthy();
    expect(screen.getByTestId('address-input')).toBeTruthy();
    expect(screen.getByTestId('coordinates-input')).toBeTruthy();
    expect(screen.getByTestId('what3words-input')).toBeTruthy();
    expect(screen.getByTestId('plus-code-input')).toBeTruthy();
    expect(screen.getByTestId('destination-poi-selector')).toBeTruthy();
    expect(screen.getByTestId('contact-name-input')).toBeTruthy();
    expect(screen.getByTestId('contact-info-input')).toBeTruthy();
    expect(screen.getByTestId('external-id-input')).toHaveProp('value', 'CAD-1');
    expect(screen.getByTestId('incident-id-input')).toBeTruthy();
    expect(screen.getByTestId('reference-id-input')).toHaveProp('value', 'R-9');
    expect(screen.getByTestId('dispatch-selection-button')).toBeTruthy();
  });

  it('hides the fields the department turned off and leaves them as stored on save', async () => {
    await renderWithPolicy(
      ['note', 'geolocation', 'what3words', 'pluscode', 'destinationPoi', 'contactName', 'contactInfo', 'externalId', 'referenceId', 'dispatchList'].map((Key) => ({
        Key,
        Visible: false,
        Required: false,
      }))
    );

    expect(screen.queryByTestId('note-input')).toBeNull();
    expect(screen.queryByTestId('coordinates-input')).toBeNull();
    expect(screen.queryByTestId('what3words-input')).toBeNull();
    expect(screen.queryByTestId('plus-code-input')).toBeNull();
    expect(screen.queryByTestId('destination-poi-selector')).toBeNull();
    expect(screen.queryByTestId('contact-name-input')).toBeNull();
    expect(screen.queryByTestId('contact-info-input')).toBeNull();
    expect(screen.queryByTestId('dispatch-selection-button')).toBeNull();
    expect(screen.queryByTestId('external-id-input')).toBeNull();
    expect(screen.queryByTestId('reference-id-input')).toBeNull();
    // Still visible.
    expect(screen.getByTestId('address-input')).toBeTruthy();
    expect(screen.getByTestId('incident-id-input')).toBeTruthy();

    save();

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: '42',
        address: '1 Main St',
        // Blank text keeps the stored value on EditCall.
        note: '',
        what3words: '',
        plusCode: '',
        contactName: '',
        contactInfo: '',
        externalId: '',
        referenceId: '',
        // No point: the stored location stays.
        latitude: undefined,
        longitude: undefined,
        // Sent as loaded, never left out or blank: an older server would clear a missing destination
        // and page everyone for a blank dispatch list.
        destinationPoiId: 7,
        dispatchEveryone: false,
        dispatchUsers: ['u1'],
        dispatchGroups: [],
        dispatchRoles: [],
        dispatchUnits: [],
      })
    );
  });

  it('sends the visible fields as the form holds them', async () => {
    await renderWithPolicy([]);

    fireEvent.changeText(screen.getByTestId('contact-name-input'), 'Jo Caller');
    save();

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'Stored note',
        contactName: 'Jo Caller',
        contactInfo: 'Stored info',
        externalId: 'CAD-1',
        incidentId: '',
        referenceId: 'R-9',
        latitude: 40.1,
        longitude: -70.2,
        destinationPoiId: 7,
        dispatchUsers: ['u1'],
      })
    );
  });

  it('marks required fields and refuses to save while one is blank both on the form and on the call', async () => {
    await renderWithPolicy([
      { Key: 'contactName', Visible: true, Required: true },
      { Key: 'note', Visible: true, Required: true },
    ]);

    expect(isMarkedRequired('calls.contact_name')).toBe(true);
    expect(isMarkedRequired('calls.note')).toBe(true);
    expect(isMarkedRequired('calls.contact_info')).toBe(false);

    // Clearing the note does not make it missing: EditCall keeps the stored note for a blank input.
    fireEvent.changeText(screen.getByTestId('note-input'), '');
    save();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.contact_name'));
    expect(mockUpdateCall).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('contact-name-input'), 'Jo Caller');
    save();

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
  });

  it('requires an identifier the call does not have yet, and saves once it is filled in', async () => {
    await renderWithPolicy([{ Key: 'incidentId', Visible: true, Required: true }]);

    expect(isMarkedRequired('calls.incident_id')).toBe(true);

    save();
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.incident_id'));
    expect(mockUpdateCall).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('incident-id-input'), 'INC-77');
    save();

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledWith(expect.objectContaining({ incidentId: 'INC-77' })));
  });

  describe('scheduled dispatch time', () => {
    it('is never required or marked on an edit', async () => {
      await renderWithPolicy([{ Key: 'dispatchOn', Visible: true, Required: true }]);

      expect(screen.getByTestId('dispatch-on-field')).toHaveProp('value', '');
      expect(screen.getByTestId('dispatch-on-field')).toHaveProp('accessibilityHint', 'clearable');
      expect(isMarkedRequired('calls.dispatch_on')).toBe(false);

      save();

      await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
      expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
    });

    it('starts from a schedule that has not gone out yet, read as UTC without a zone, and does not resend it unchanged', async () => {
      // Five minutes out: inside the 15-minute rule, which must not block a save that never touched it.
      const upcoming = inMinutes(5);
      mockDetailState.call = { ...BASE_CALL, DispatchedOnUtc: upcoming.replace(/Z$/, '') };
      await renderWithPolicy([]);

      expect(screen.getByTestId('dispatch-on-field')).toHaveProp('value', upcoming);
      // EditCall cannot remove a schedule, so the picker must not pretend it can.
      expect(screen.getByTestId('dispatch-on-field')).toHaveProp('accessibilityHint', 'not-clearable');

      save();

      await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
      expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
    });

    it('leaves the field empty for a call that was already sent', async () => {
      mockDetailState.call = { ...BASE_CALL, DispatchedOnUtc: inMinutes(-30) };
      await renderWithPolicy([]);

      expect(screen.getByTestId('dispatch-on-field')).toHaveProp('value', '');
    });

    it('refuses a new time less than 15 minutes ahead', async () => {
      await renderWithPolicy([]);

      fireEvent.changeText(screen.getByTestId('dispatch-on-field'), inMinutes(10));
      save();

      await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.dispatch_on_too_soon'));
      expect(mockUpdateCall).not.toHaveBeenCalled();
    });

    it('sends a new valid time as DispatchOnUtc', async () => {
      mockDetailState.call = { ...BASE_CALL, DispatchedOnUtc: inMinutes(120) };
      await renderWithPolicy([]);

      const moved = inMinutes(45);
      fireEvent.changeText(screen.getByTestId('dispatch-on-field'), moved);
      save();

      await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledWith(expect.objectContaining({ dispatchOnUtc: moved })));
    });

    it('is not shown or sent when the department hides it', async () => {
      mockDetailState.call = { ...BASE_CALL, DispatchedOnUtc: inMinutes(120) };
      await renderWithPolicy([{ Key: 'dispatchOn', Visible: false, Required: false }]);

      expect(screen.queryByTestId('dispatch-on-field')).toBeNull();
      save();

      await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
      expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
    });
  });

  it('requires a dispatch list on an active call', async () => {
    mockDetailState.callExtraData = { Dispatches: [] };
    await renderWithPolicy([{ Key: 'dispatchList', Visible: true, Required: true }]);

    save();
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.dispatch_to'));
    expect(mockUpdateCall).not.toHaveBeenCalled();
  });

  it('does not require the dispatch list of a pending call', async () => {
    mockDetailState.call = { ...BASE_CALL, State: 8 };
    mockDetailState.callExtraData = { Dispatches: [] };
    await renderWithPolicy([{ Key: 'dispatchList', Visible: true, Required: true }]);

    save();
    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('names the fields the server says are missing, by their labels', async () => {
    const config = { headers: new AxiosHeaders() };
    mockUpdateCall.mockRejectedValue(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, { status: 400, statusText: '', data: 'Required call fields are missing: incidentId, what3words', headers: {}, config })
    );
    await renderWithPolicy([]);

    save();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.incident_id, calls.what3words'));
  });

  it('shows the generic error for any other failure', async () => {
    mockUpdateCall.mockRejectedValue(new Error('offline'));
    await renderWithPolicy([]);

    save();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('call_detail.update_call_error'));
  });
});
