import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import { getMapIconLegend } from '@/api/mapping/mapping';
import { MAP_ICONS } from '@/constants/map-icons';
import { type GetMapIconLegendResult } from '@/models/v4/mapping/getMapIconLegendResult';
import { type GetMapIconLegendResultData, type MapLegendRowData, type MapLegendStateData, type MapLegendStyleData } from '@/models/v4/mapping/getMapIconLegendResultData';
import { terminologyStore } from '@/stores/terminology/store';

import { MapLegendSheet } from '../map-legend-sheet';

jest.mock('@/api/mapping/mapping', () => ({
  getMapIconLegend: jest.fn(),
}));

jest.mock('@/api/config/terminology', () => ({
  getTerminology: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// The few chrome strings whose interpolation the assertions read; every other key renders as itself.
const mockTranslations: Record<string, string> = {
  'map.legend.name_list': '{{label}}: {{names}}',
  'map.legend.list_separator': ', ',
  'map.legend.statuses': 'Statuses: {{name}}',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (mockTranslations[key] ?? key).replace(/{{(\w+)}}/g, (_match: string, name: string) => String(options?.[name] ?? '')),
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: unknown) => Component),
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
  cssInterop: jest.fn((Component: unknown) => Component),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});

// The app's sheet: renders its children while open (open/close animation is CustomBottomSheet's own concern).
jest.mock('@/components/ui/bottom-sheet', () => {
  const { View } = require('react-native');
  return {
    CustomBottomSheet: ({ children, isOpen, testID }: { children: React.ReactNode; isOpen: boolean; testID?: string }) => (isOpen ? <View testID={testID}>{children}</View> : null),
  };
});

jest.mock('@/components/ui/hstack', () => {
  const { View } = require('react-native');
  return { HStack: ({ children, testID }: { children: React.ReactNode; testID?: string }) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children, testID }: { children: React.ReactNode; testID?: string }) => <View testID={testID}>{children}</View> };
});

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

jest.mock('@/components/ui/heading', () => {
  const { Text } = require('react-native');
  return { Heading: ({ children }: { children: React.ReactNode }) => <Text accessibilityRole="header">{children}</Text> };
});

jest.mock('@/components/ui/pressable', () => {
  const { Pressable } = require('react-native');
  return { Pressable };
});

jest.mock('@/components/ui/spinner', () => {
  const { ActivityIndicator } = require('react-native');
  return { Spinner: () => <ActivityIndicator /> };
});

jest.mock('@/components/ui/button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ children, onPress, testID }: { children: React.ReactNode; onPress: () => void; testID?: string }) => (
      <Pressable onPress={onPress} testID={testID} accessibilityRole="button">
        {children}
      </Pressable>
    ),
    ButtonText: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

const mockGetMapIconLegend = getMapIconLegend as jest.MockedFunction<typeof getMapIconLegend>;

const hidden = { includeHiddenElements: true };
const API = 'https://api.example.test/api/v4/TypeIcons';

const style = (overrides: Partial<MapLegendStyleData>): MapLegendStyleData => ({
  Key: 'available',
  Color: '#16a34a',
  Meanings: [],
  UnitStatuses: [],
  PersonnelStatuses: [],
  Priorities: [],
  UnitPinIconUrl: null,
  PersonPinIconUrl: null,
  CallPinIconUrl: null,
  ...overrides,
});

const state = (overrides: Partial<MapLegendStateData>): MapLegendStateData => ({
  Id: 1,
  Name: 'State',
  Color: null,
  IconStyle: 'unknown',
  IconUrl: null,
  PinIconUrl: null,
  ImagePath: 'Call',
  IsVariant: false,
  ...overrides,
});

const row = (overrides: Partial<MapLegendRowData>): MapLegendRowData => ({
  Id: 1,
  Name: 'Row',
  StatusSetName: null,
  IconUrl: null,
  PinIconUrl: null,
  ImagePath: 'Call',
  States: [],
  ...overrides,
});

/** A department with renamed / custom everything: none of these names exist in the app. */
const makeLegend = (overrides: Partial<GetMapIconLegendResultData> = {}): GetMapIconLegendResultData => ({
  StatusStyles: [
    style({
      Key: 'responding',
      Color: '#2563eb',
      UnitStatuses: ['En Route', 'Rolling'],
      PersonnelStatuses: ['Coming In'],
      UnitPinIconUrl: `${API}/Pins/Engine-responding?v=1`,
      PersonPinIconUrl: `${API}/Pins/Person-responding?v=1`,
    }),
    style({ Key: 'unknown', Color: '#6b7280', UnitStatuses: ['Fuel Stop'], PersonnelStatuses: [], UnitPinIconUrl: `${API}/Pins/Engine-unknown?v=1`, PersonPinIconUrl: `${API}/Pins/Person-unknown?v=1` }),
  ],
  PriorityStyles: [
    style({ Key: 'emergency', Color: '#dc2626', Priorities: ['Code 3', 'Mayday'], CallPinIconUrl: `${API}/Pins/Call-emergency?v=1` }),
    style({ Key: 'unknown', Color: '#6b7280', Priorities: ['Routine Transfer'], CallPinIconUrl: `${API}/Pins/Call-unknown?v=1` }),
  ],
  Calls: [
    row({ Id: null, Name: 'SERVER NONE CALL', ImagePath: 'Call', States: [state({ Id: 11, Name: 'Code 3', Color: '#dc2626', IconStyle: 'emergency', PinIconUrl: `${API}/Pins/Call-emergency?v=1` })] }),
    row({
      Id: 5,
      Name: 'Brush Fire',
      ImagePath: 'fire',
      IconUrl: 'https://cdn.example.test/call-types/5/icon.png',
      States: [
        state({ Id: 11, Name: 'Code 3', IconStyle: 'emergency', IconUrl: 'https://cdn.example.test/call-types/5/p11.png', PinIconUrl: `${API}/Pins/Call-emergency?v=1`, ImagePath: 'fire', IsVariant: true }),
        state({ Id: 12, Name: 'Routine Transfer', IconStyle: 'unknown', PinIconUrl: `${API}/Pins/Call-unknown?v=1`, ImagePath: 'fire' }),
        state({ Id: 13, Name: 'Legacy Level', IconStyle: 'unknown', ImagePath: 'fire' }),
      ],
    }),
  ],
  Units: [
    row({ Id: null, Name: 'SERVER NONE UNIT', ImagePath: 'Engine_Responding', StatusSetName: null }),
    row({
      Id: 7,
      Name: 'Brush Truck',
      ImagePath: 'bulldozer',
      StatusSetName: 'Wildland Set',
      States: [state({ Id: 70, Name: 'Rolling', IconStyle: 'responding', PinIconUrl: `${API}/Pins/Engine-responding?v=1`, ImagePath: 'bulldozer' })],
    }),
  ],
  Personnel: [row({ Id: null, Name: 'SERVER NONE ROLE', ImagePath: 'Person_RespondingCall' }), row({ Id: 3, Name: 'Paramedic', ImagePath: 'Person_RespondingCall', IconUrl: 'https://cdn.example.test/roles/3/icon.png' })],
  PoiTypes: [
    { PoiTypeId: 9, Name: 'Dry Hydrant Cistern', Color: '#0ea5e9', PoiImage: 'map-icon-hospital', ImagePath: 'hospital', Marker: 'MAP_PIN', IconUrl: null },
    { PoiTypeId: 10, Name: 'Landing Zone', Color: null, PoiImage: 'map-icon-airport', ImagePath: 'airport', Marker: 'SQUARE', IconUrl: 'https://cdn.example.test/poi-types/10/icon.png' },
  ],
  ...overrides,
});

const envelope = (data: Partial<GetMapIconLegendResultData> | null): GetMapIconLegendResult =>
  ({ PageSize: 0, Timestamp: '', Version: 'v4', Node: '', RequestId: 'r1', Status: 'success', Environment: 'test', Data: data }) as unknown as GetMapIconLegendResult;

/** The legend icon labelled `label`, i.e. the wrapper the sheet draws around the map's own pin image. */
const icon = (label: string) => screen.getByLabelText(label);

const renderOpen = async (data: Partial<GetMapIconLegendResultData> | null = makeLegend(), props: { showHydrants?: boolean } = {}) => {
  mockGetMapIconLegend.mockResolvedValueOnce(envelope(data));
  const onClose = jest.fn();
  const utils = render(<MapLegendSheet isOpen onClose={onClose} {...props} />);
  // A loaded legend always has its last section (the station). Waiting on a query that fails cheaply matters: a failing
  // `expect(element).toBeNull()` pretty-prints the whole fiber on every retry, which is slow enough to time the wait out.
  await screen.findByTestId('map-legend-other');
  expect(screen.queryByTestId('map-legend-loading')).toBeNull();
  return { ...utils, onClose };
};

describe('MapLegendSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    terminologyStore.setState({ names: {}, isLoaded: true, error: null, identityKey: null });
  });

  it('does not fetch while closed', () => {
    const { unmount } = render(<MapLegendSheet isOpen={false} onClose={jest.fn()} />);

    expect(mockGetMapIconLegend).not.toHaveBeenCalled();
    expect(screen.queryByTestId('map-legend-sheet')).toBeNull();
    unmount();
  });

  it('shows a spinner while the legend loads', async () => {
    let resolve: (value: GetMapIconLegendResult) => void = () => undefined;
    mockGetMapIconLegend.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { unmount } = render(<MapLegendSheet isOpen onClose={jest.fn()} />);

    expect(screen.getByTestId('map-legend-loading')).toBeTruthy();
    expect(screen.getByText('map.legend.loading')).toBeTruthy();
    expect(mockGetMapIconLegend).toHaveBeenCalledTimes(1);

    await act(async () => resolve(envelope(makeLegend())));
    expect(screen.queryByTestId('map-legend-loading')).toBeNull();
    expect(screen.getByText('Brush Fire')).toBeTruthy();
    unmount();
  });

  it("renders the department's own names for statuses, priorities, types, roles and POI types", async () => {
    const { unmount } = await renderOpen();

    // Status colours: the department's unit and personnel status names in each style.
    const statusSection = within(screen.getByTestId('map-legend-status-colors'));
    expect(statusSection.getByText('map.legend.units: En Route, Rolling')).toBeTruthy();
    expect(statusSection.getByText('map.legend.personnel: Coming In')).toBeTruthy();
    expect(statusSection.getByText('map.legend.units: Fuel Stop')).toBeTruthy();
    // An empty list draws no line.
    expect(statusSection.queryByText('map.legend.personnel: ')).toBeNull();

    // Priority colours: the department's priority names.
    const prioritySection = within(screen.getByTestId('map-legend-priority-colors'));
    expect(prioritySection.getByText('map.legend.priorities: Code 3, Mayday')).toBeTruthy();
    expect(prioritySection.getByText('map.legend.priorities: Routine Transfer')).toBeTruthy();

    // Rows and their states.
    const calls = within(screen.getByTestId('map-legend-calls'));
    expect(calls.getByText('Brush Fire')).toBeTruthy();
    expect(calls.getAllByText('Code 3')).toHaveLength(2);
    expect(calls.getByText('Routine Transfer')).toBeTruthy();
    expect(within(screen.getByTestId('map-legend-units')).getByText('Brush Truck')).toBeTruthy();
    expect(within(screen.getByTestId('map-legend-units')).getByText('Rolling')).toBeTruthy();
    expect(within(screen.getByTestId('map-legend-personnel')).getByText('Paramedic')).toBeTruthy();

    // POI types, after the station.
    const other = within(screen.getByTestId('map-legend-other'));
    expect(other.getByText('map.legend.station')).toBeTruthy();
    expect(other.getByText('Dry Hydrant Cistern')).toBeTruthy();
    expect(other.getByText('Landing Zone')).toBeTruthy();
    unmount();
  });

  it('labels the Id-null rows itself and ignores the name the server sent for them', async () => {
    const { unmount } = await renderOpen();

    expect(within(screen.getByTestId('map-legend-calls')).getByText('map.legend.no_call_type')).toBeTruthy();
    expect(within(screen.getByTestId('map-legend-units')).getByText('map.legend.no_unit_type')).toBeTruthy();
    expect(within(screen.getByTestId('map-legend-personnel')).getByText('map.legend.no_role_icon')).toBeTruthy();
    expect(screen.queryByText('SERVER NONE CALL')).toBeNull();
    expect(screen.queryByText('SERVER NONE UNIT')).toBeNull();
    expect(screen.queryByText('SERVER NONE ROLE')).toBeNull();
    expect(screen.getByText('map.legend.personnel_note')).toBeTruthy();
    unmount();
  });

  it('subtitles a unit type with its status set name, or the built-in unit statuses label when it has none', async () => {
    const { unmount } = await renderOpen(
      makeLegend({
        Units: [row({ Id: null, ImagePath: 'Engine_Responding' }), row({ Id: 7, Name: 'Brush Truck', StatusSetName: 'Wildland Set' }), row({ Id: 8, Name: 'Ladder', StatusSetName: '  ' })],
      })
    );

    const units = within(screen.getByTestId('map-legend-units'));
    expect(units.getByText('Statuses: Wildland Set')).toBeTruthy();
    // The none row and the blank set both use the built-in statuses.
    expect(units.getAllByText('map.legend.built_in_unit_statuses')).toHaveLength(2);
    unmount();
  });

  it('labels the styles by key, with separate wording for an unknown status and an unknown priority', async () => {
    const { unmount } = await renderOpen();

    const statusSection = within(screen.getByTestId('map-legend-status-colors'));
    expect(statusSection.getByText('map.legend.style.responding')).toBeTruthy();
    expect(statusSection.getByText('map.legend.style.unknown')).toBeTruthy();

    const prioritySection = within(screen.getByTestId('map-legend-priority-colors'));
    expect(prioritySection.getByText('map.legend.style.emergency')).toBeTruthy();
    expect(prioritySection.getByText('map.legend.priority_unknown')).toBeTruthy();
    expect(prioritySection.queryByText('map.legend.style.unknown')).toBeNull();
    unmount();
  });

  it('shows the key of a style this build does not know rather than nothing', async () => {
    const { unmount } = await renderOpen(makeLegend({ StatusStyles: [style({ Key: 'decontaminating', UnitStatuses: ['Decon'] })] }));

    expect(within(screen.getByTestId('map-legend-status-colors')).getByText('decontaminating')).toBeTruthy();
    unmount();
  });

  describe('icons are drawn the way the map draws markers', () => {
    it('draws the uploaded icon (contain fit) when a state has one, even with a styled pin', async () => {
      const { unmount } = await renderOpen();

      const upload = within(icon('Brush Fire · Code 3')).getByTestId('pin-type-icon', hidden);
      expect(upload.props.source).toEqual({ uri: 'https://cdn.example.test/call-types/5/p11.png' });
      expect(upload.props.contentFit).toBe('contain');
      expect(upload.props.style).toEqual({ width: 32, height: 32 });
      expect(within(icon('Brush Fire · Code 3')).queryByTestId('pin-styled-icon', hidden)).toBeNull();
      unmount();
    });

    it('draws the styled pin when there is no upload', async () => {
      const { unmount } = await renderOpen();

      const pin = within(icon('Brush Fire · Routine Transfer')).getByTestId('pin-styled-icon', hidden);
      expect(pin.props.source).toEqual({ uri: `${API}/Pins/Call-unknown?v=1` });
      // Same box and cover fit as the map's styled pin.
      expect(pin.props.contentFit).toBe('cover');
      expect(pin.props.style).toEqual({ width: 32, height: 32 });
      unmount();
    });

    it('draws the bundled pin when there is neither an upload nor a styled pin', async () => {
      const { unmount } = await renderOpen();

      const box = within(icon('Brush Fire · Legacy Level'));
      expect(box.queryByTestId('pin-type-icon', hidden)).toBeNull();
      expect(box.queryByTestId('pin-styled-icon', hidden)).toBeNull();
      expect(box.UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.fire.uri);
      unmount();
    });

    it('falls back from a failed upload to the styled pin, then to the bundled pin', async () => {
      const { unmount } = await renderOpen();

      fireEvent(within(icon('Brush Fire · Code 3')).getByTestId('pin-type-icon', hidden), 'error', { error: 'boom' });
      expect(within(icon('Brush Fire · Code 3')).getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: `${API}/Pins/Call-emergency?v=1` });

      fireEvent(within(icon('Brush Fire · Code 3')).getByTestId('pin-styled-icon', hidden), 'error', { error: 'boom' });
      expect(within(icon('Brush Fire · Code 3')).UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.fire.uri);
      unmount();
    });

    it("draws each row's own icon beside its name", async () => {
      const { unmount } = await renderOpen();

      expect(within(icon('Brush Fire')).getByTestId('pin-type-icon', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/call-types/5/icon.png' });
      expect(within(icon('Paramedic')).getByTestId('pin-type-icon', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/roles/3/icon.png' });
      expect(within(icon('Brush Truck')).UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.bulldozer.uri);
      unmount();
    });

    it('draws the status and priority styles with their default pins, falling back to the default bundled pin', async () => {
      const { unmount } = await renderOpen();

      expect(within(icon('map.legend.units · map.legend.style.responding')).getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: `${API}/Pins/Engine-responding?v=1` });
      expect(within(icon('map.legend.personnel · map.legend.style.responding')).getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: `${API}/Pins/Person-responding?v=1` });
      expect(within(icon('map.legend.calls · map.legend.style.emergency')).getByTestId('pin-styled-icon', hidden).props.source).toEqual({ uri: `${API}/Pins/Call-emergency?v=1` });

      fireEvent(within(icon('map.legend.units · map.legend.style.responding')).getByTestId('pin-styled-icon', hidden), 'error', { error: 'boom' });
      // The default unit pin of the "units with no type" row.
      expect(within(icon('map.legend.units · map.legend.style.responding')).UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.engine_responding.uri);
      unmount();
    });

    it('draws POI types as the map draws POI markers: the upload, else the coloured shape', async () => {
      const { unmount } = await renderOpen();

      expect(within(icon('Landing Zone')).getByTestId('poi-marker-type-icon', hidden).props.source).toEqual({ uri: 'https://cdn.example.test/poi-types/10/icon.png' });
      expect(within(icon('Dry Hydrant Cistern')).queryByTestId('poi-marker-type-icon', hidden)).toBeNull();
      expect(icon('Dry Hydrant Cistern').findAll((node) => (node.type as unknown) === 'Path').length).toBeGreaterThan(0);
      unmount();
    });

    it('draws the station marker, and the hydrant marker only while the map shows hydrants', async () => {
      const view = await renderOpen();
      expect(within(icon('map.legend.station')).UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.station.uri);
      expect(screen.queryByLabelText('map.legend.hydrant')).toBeNull();
      expect(screen.getByText('map.legend.other')).toBeTruthy();
      view.unmount();

      const utils = await renderOpen(makeLegend(), { showHydrants: true });
      // Hydrant pins have no bundled image of their own: the map draws them with its neutral fallback pin, and so does the legend.
      expect(within(icon('map.legend.hydrant')).UNSAFE_getByType(Image).props.source).toBe(MAP_ICONS.flag.uri);
      expect(screen.getByText('map.legend.other_with_hydrants')).toBeTruthy();
      utils.unmount();
    });
  });

  it("titles the calls, units and personnel sections with the department's terminology", async () => {
    terminologyStore.setState({ names: { 'module.calls': 'Incidents', 'module.units': 'Apparatus', 'module.personnel': 'Members' } });
    const { unmount } = await renderOpen();

    expect(within(screen.getByTestId('map-legend-calls')).getByText('Incidents')).toBeTruthy();
    expect(within(screen.getByTestId('map-legend-units')).getByText('Apparatus')).toBeTruthy();
    expect(within(screen.getByTestId('map-legend-personnel')).getByText('Members')).toBeTruthy();
    expect(screen.getByText('Apparatus: En Route, Rolling')).toBeTruthy();
    unmount();
  });

  it('treats absent lists as empty and still shows the station', async () => {
    const { unmount } = await renderOpen({ StatusStyles: undefined, Calls: null as unknown as MapLegendRowData[], Units: [row({ Id: 4, Name: 'Tender', States: undefined as unknown as MapLegendStateData[] })] });

    expect(screen.queryByTestId('map-legend-status-colors')).toBeNull();
    expect(screen.queryByTestId('map-legend-priority-colors')).toBeNull();
    expect(screen.queryByTestId('map-legend-calls')).toBeNull();
    expect(screen.queryByTestId('map-legend-personnel')).toBeNull();
    expect(screen.getByText('Tender')).toBeTruthy();
    expect(screen.getByText('map.legend.station')).toBeTruthy();
    unmount();
  });

  it('shows an error with Retry when the request fails, and loads on retry', async () => {
    mockGetMapIconLegend.mockRejectedValueOnce(new Error('Network Error'));
    const { unmount } = render(<MapLegendSheet isOpen onClose={jest.fn()} />);

    await screen.findByTestId('map-legend-error');
    expect(screen.getByText('map.legend.error')).toBeTruthy();

    mockGetMapIconLegend.mockResolvedValueOnce(envelope(makeLegend()));
    fireEvent.press(screen.getByTestId('map-legend-retry'));

    await screen.findByText('Brush Fire');
    expect(screen.queryByTestId('map-legend-error')).toBeNull();
    expect(mockGetMapIconLegend).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('shows the error when the response carries no data', async () => {
    mockGetMapIconLegend.mockResolvedValueOnce(envelope(null));
    const { unmount } = render(<MapLegendSheet isOpen onClose={jest.fn()} />);

    await screen.findByTestId('map-legend-error');
    unmount();
  });

  it('fetches again each time it opens, so department changes show on the next open', async () => {
    mockGetMapIconLegend.mockResolvedValueOnce(envelope(makeLegend()));
    const onClose = jest.fn();
    const { rerender, unmount } = render(<MapLegendSheet isOpen onClose={onClose} />);
    await screen.findByText('Brush Fire');

    rerender(<MapLegendSheet isOpen={false} onClose={onClose} />);
    expect(mockGetMapIconLegend).toHaveBeenCalledTimes(1);

    // The department renamed the call type in the meantime.
    mockGetMapIconLegend.mockResolvedValueOnce(envelope(makeLegend({ Calls: [row({ Id: 5, Name: 'Wildland Fire', ImagePath: 'fire' })] })));
    rerender(<MapLegendSheet isOpen onClose={onClose} />);

    await screen.findByText('Wildland Fire');
    expect(screen.queryByText('Brush Fire')).toBeNull();
    expect(mockGetMapIconLegend).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('cancels the request when closed before it answers', async () => {
    mockGetMapIconLegend.mockReturnValueOnce(new Promise(() => undefined));
    const { rerender, unmount } = render(<MapLegendSheet isOpen onClose={jest.fn()} />);
    const signal = mockGetMapIconLegend.mock.calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(false);

    rerender(<MapLegendSheet isOpen={false} onClose={jest.fn()} />);

    expect(signal.aborted).toBe(true);
    unmount();
  });

  it('closes from its close button', async () => {
    const { onClose, unmount } = await renderOpen();

    fireEvent.press(screen.getByLabelText('common.close'));

    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });
});
