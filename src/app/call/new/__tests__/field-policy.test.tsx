import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders } from 'axios';
import React from 'react';

import { createCall } from '@/api/calls/calls';
import { getNewCallFieldPolicy } from '@/api/calls/newCallFieldPolicy';

import NewCall from '../index';

const mockToast = { show: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
let mockPickedLocation = { latitude: 0, longitude: 0 };

// Stable references: the screen re-renders from these on every store read.
const mockCallsState = {
  callPriorities: [{ Id: 1, Name: 'High' }],
  callTypes: [{ Id: '1', Name: 'Fire' }],
  destinationPois: [],
  poiTypes: [],
  isLoading: false,
  error: null,
  fetchCallFormData: jest.fn(),
};

jest.mock('@/api/calls/calls', () => ({ createCall: jest.fn() }));
jest.mock('@/api/calls/newCallFieldPolicy', () => ({ getNewCallFieldPolicy: jest.fn() }));
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
}));

jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/components/common/header-back-button', () => ({ HeaderBackButton: () => null }));
jest.mock('@/components/common/loading', () => ({ Loading: () => null }));
jest.mock('@/components/maps/location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/maps/full-screen-location-picker', () => ({
  __esModule: true,
  default: ({ onLocationSelected }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="full-screen-picker" onPress={() => onLocationSelected(mockPickedLocation)}>
        <Text>pick</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/components/calls/dispatch-selection-modal', () => ({ DispatchSelectionModal: () => null }));
jest.mock('@/components/common/date-time-field', () => ({
  DateTimeField: ({ value, onChange, testID }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput testID={testID} value={value} onChangeText={onChange} />;
  },
}));
jest.mock('@/components/ui/lucide-icons', () => ({ ChevronDownIcon: () => null, PlusIcon: () => null }));

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
  const { View, TextInput } = require('react-native');
  const Pass = ({ children }: any) => <View>{children}</View>;
  return {
    Select: ({ children, onValueChange, selectedValue }: any) => (
      <View>
        {children}
        <TextInput testID="select" value={selectedValue} onChangeText={onValueChange} />
      </View>
    ),
    SelectBackdrop: () => null,
    SelectContent: Pass,
    SelectIcon: () => null,
    SelectInput: () => null,
    SelectItem: () => null,
    SelectPortal: Pass,
    SelectTrigger: Pass,
  };
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

const mockedGetPolicy = getNewCallFieldPolicy as jest.Mock;
const mockedCreateCall = createCall as jest.Mock;

const renderWithPolicy = async (rules: { Key: string; Visible: boolean; Required: boolean }[]) => {
  mockedGetPolicy.mockResolvedValue({ Rules: rules });
  render(<NewCall />);
  await waitFor(() => expect(screen.getByTestId('create-call-button')).not.toBeDisabled());
};

const fillBuiltIns = () => {
  fireEvent.changeText(screen.getByTestId('calls.name_placeholder'), 'Structure fire');
  fireEvent.changeText(screen.getByTestId('calls.nature_placeholder'), 'Smoke showing');
  const [priority, type] = screen.getAllByTestId('select');
  fireEvent.changeText(priority, 'High');
  fireEvent.changeText(type, 'Fire');
};

const create = () => fireEvent.press(screen.getByTestId('create-call-button'));

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

const isMarkedRequired = (label: string) => screen.getAllByTestId('required-field').some((field) => within(field).queryByText(label) !== null);

describe('NewCall field policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPickedLocation = { latitude: 0, longitude: 0 };
    mockedCreateCall.mockResolvedValue({});
  });

  it('hides the fields the department turned off', async () => {
    await renderWithPolicy(['note', 'address', 'what3words', 'destinationPoi', 'contactInfo', 'dispatchList'].map((Key) => ({ Key, Visible: false, Required: false })));

    expect(screen.queryByTestId('calls.note_placeholder')).toBeNull();
    expect(screen.queryByTestId('address-input')).toBeNull();
    expect(screen.queryByTestId('what3words-input')).toBeNull();
    expect(screen.queryByTestId('destination-poi-selector')).toBeNull();
    expect(screen.queryByTestId('calls.contact_info_placeholder')).toBeNull();
    expect(screen.queryByText('calls.dispatch_to')).toBeNull();
    expect(screen.getByTestId('coordinates-input')).toBeTruthy();
    expect(screen.getByTestId('plus-code-input')).toBeTruthy();
    expect(screen.getByTestId('calls.contact_name_placeholder')).toBeTruthy();
  });

  it('marks required fields, names the blank ones and sends the reporter details once filled', async () => {
    await renderWithPolicy([
      { Key: 'contactName', Visible: true, Required: true },
      { Key: 'contactInfo', Visible: true, Required: true },
      { Key: 'destinationPoi', Visible: true, Required: true },
    ]);

    expect(isMarkedRequired('calls.contact_name')).toBe(true);
    expect(isMarkedRequired('calls.contact_info')).toBe(true);
    expect(isMarkedRequired('calls.name')).toBe(true);
    expect(isMarkedRequired('calls.note')).toBe(false);
    expect(screen.getByText('destination*')).toBeTruthy();

    fillBuiltIns();
    fireEvent.changeText(screen.getByTestId('calls.contact_name_placeholder'), 'Jo Caller');
    create();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.contact_info, calls.destination_poi'));
    expect(mockedCreateCall).not.toHaveBeenCalled();
  });

  it('sends the reporter name and contact details it collects', async () => {
    await renderWithPolicy([]);

    fillBuiltIns();
    fireEvent.changeText(screen.getByTestId('calls.contact_name_placeholder'), 'Jo Caller');
    fireEvent.changeText(screen.getByTestId('calls.contact_info_placeholder'), '555-0100');
    create();

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
    expect(mockedCreateCall).toHaveBeenCalledWith(expect.objectContaining({ contactName: 'Jo Caller', contactInfo: '555-0100', priority: 1, type: 'Fire' }));
  });

  it('offers the call identifiers, enforces a required one and sends them', async () => {
    await renderWithPolicy([
      { Key: 'referenceId', Visible: false, Required: false },
      { Key: 'incidentId', Visible: true, Required: true },
    ]);

    expect(screen.getByTestId('external-id-input')).toBeTruthy();
    expect(screen.queryByTestId('reference-id-input')).toBeNull();
    expect(isMarkedRequired('calls.incident_id')).toBe(true);
    expect(isMarkedRequired('call_detail.external_id')).toBe(false);

    fillBuiltIns();
    create();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.incident_id'));
    expect(mockedCreateCall).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('external-id-input'), 'CAD-1');
    fireEvent.changeText(screen.getByTestId('incident-id-input'), 'INC-77');
    create();

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
    expect(mockedCreateCall).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'CAD-1', incidentId: 'INC-77', referenceId: '' }));
  });

  it('requires a scheduled dispatch time when the department does', async () => {
    await renderWithPolicy([{ Key: 'dispatchOn', Visible: true, Required: true }]);

    expect(isMarkedRequired('calls.dispatch_on')).toBe(true);

    fillBuiltIns();
    create();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.dispatch_on'));
    expect(mockedCreateCall).not.toHaveBeenCalled();
  });

  it('refuses a dispatch time less than 15 minutes ahead', async () => {
    await renderWithPolicy([]);
    fillBuiltIns();

    fireEvent.changeText(screen.getByTestId('dispatch-on-field'), inMinutes(10));
    create();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.dispatch_on_too_soon'));
    expect(mockedCreateCall).not.toHaveBeenCalled();
  });

  it('sends a valid dispatch time as DispatchOnUtc, and none when it is left empty', async () => {
    await renderWithPolicy([]);
    fillBuiltIns();

    create();
    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
    expect(mockedCreateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();

    const scheduled = inMinutes(60);
    fireEvent.changeText(screen.getByTestId('dispatch-on-field'), scheduled);
    create();

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(2));
    expect(mockedCreateCall.mock.calls[1][0]).toEqual(expect.objectContaining({ dispatchOnUtc: scheduled }));
  });

  it('hides the dispatch time when the department does', async () => {
    await renderWithPolicy([{ Key: 'dispatchOn', Visible: false, Required: false }]);

    expect(screen.queryByTestId('dispatch-on-field')).toBeNull();
  });

  it('does not take 0,0 as a location when one is required', async () => {
    await renderWithPolicy([{ Key: 'geolocation', Visible: true, Required: true }]);
    fillBuiltIns();

    fireEvent.press(screen.getByText('calls.select_location'));
    fireEvent.press(screen.getByTestId('full-screen-picker'));
    create();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.coordinates'));
    expect(mockedCreateCall).not.toHaveBeenCalled();
  });

  it('accepts a real location when one is required', async () => {
    mockPickedLocation = { latitude: 0, longitude: 32.5 };
    await renderWithPolicy([{ Key: 'geolocation', Visible: true, Required: true }]);
    fillBuiltIns();

    fireEvent.press(screen.getByText('calls.select_location'));
    fireEvent.press(screen.getByTestId('full-screen-picker'));
    create();

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
    expect(mockedCreateCall).toHaveBeenCalledWith(expect.objectContaining({ latitude: 0, longitude: 32.5 }));
  });

  it('names the fields the server says are missing, by their labels', async () => {
    const config = { headers: new AxiosHeaders() };
    mockedCreateCall.mockRejectedValue(new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, { status: 400, statusText: '', data: 'Required call fields are missing: referenceId', headers: {}, config }));
    await renderWithPolicy([]);
    fillBuiltIns();

    create();

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|call_detail.reference_id'));
  });
});
