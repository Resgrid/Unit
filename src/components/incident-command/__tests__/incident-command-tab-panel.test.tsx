import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import type { ResourceIncidentView } from '@/models/v4/incidentCommand/resourceIncidentView';

import { IncidentCommandTabPanel } from '../incident-command-tab-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  MailIcon: () => {
    const { View } = require('react-native');
    return <View testID="mail-icon" />;
  },
  PhoneIcon: () => {
    const { View } = require('react-native');
    return <View testID="phone-icon" />;
  },
  // Icons used by the incident chat section rendered inside the panel.
  MessageCircle: () => {
    const { View } = require('react-native');
    return <View testID="message-icon" />;
  },
  MessagesSquare: () => {
    const { View } = require('react-native');
    return <View testID="messages-icon" />;
  },
  ShieldCheck: () => {
    const { View } = require('react-native');
    return <View testID="shield-icon" />;
  },
  Users: () => {
    const { View } = require('react-native');
    return <View testID="users-icon" />;
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  BadgeText: ({ children }: any) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/pressable', () => ({
  Pressable: ({ children, onPress, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} {...props}>
        {children}
      </TouchableOpacity>
    );
  },
}));

jest.mock('@/components/ui/spinner', () => ({
  Spinner: (props: any) => {
    const { View } = require('react-native');
    return <View testID="spinner" {...props} />;
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText {...props}>{children}</RNText>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

const mockFetchIncidentView = jest.fn();

interface MockStoreState {
  view: ResourceIncidentView | null;
  isLoading: boolean;
  error: string | null;
  fetchIncidentView: typeof mockFetchIncidentView;
}

let mockStoreState: MockStoreState;

jest.mock('@/stores/calls/incident-command-store', () => ({
  useIncidentCommandStore: (selector: any) => selector(mockStoreState),
}));

const createMockView = (overrides: Partial<ResourceIncidentView> = {}): ResourceIncidentView =>
  ({
    IncidentCommandId: 'ic-1',
    CallId: 123,
    Status: 0,
    EstablishedOn: '2026-07-01T10:00:00Z',
    EstimatedEndOn: '2026-07-01T18:00:00Z',
    ClosedOn: null,
    ImportantInformation: 'Watch for downed power lines',
    IncidentActionPlan: 'Attack from the north side',
    Commander: { UserId: 'user-1', Name: 'Chief Smith', Phone: '555-1234', Email: 'chief@example.com' },
    Objectives: [
      {
        TacticalObjectiveId: 'obj-1',
        IncidentCommandId: 'ic-1',
        DepartmentId: 1,
        CallId: 123,
        Name: 'Primary search',
        ObjectiveType: 1,
        Status: 2,
        AutoPopulated: false,
        CompletedByUserId: null,
        CompletedOn: null,
        Description: null,
        ProgressPercent: 50,
        Priority: 1,
        TargetCompleteOn: null,
        SortOrder: 0,
        ModifiedOn: null,
      },
    ],
    Needs: [
      {
        IncidentNeedId: 'need-1',
        IncidentCommandId: 'ic-1',
        DepartmentId: 1,
        CallId: 123,
        Name: 'Water tenders',
        Description: null,
        Category: 0,
        Status: 1,
        QuantityRequested: 4,
        QuantityFulfilled: 2,
        Priority: 1,
        CreatedByUserId: null,
        CreatedOn: '2026-07-01T10:15:00Z',
        MetByUserId: null,
        MetOn: null,
        SortOrder: 0,
        ModifiedOn: null,
      },
    ],
    Notes: [
      {
        IncidentNoteId: 'note-1',
        IncidentCommandId: 'ic-1',
        DepartmentId: 1,
        CallId: 123,
        NoteType: 0,
        Visibility: 0,
        Title: 'Situation update',
        Body: 'Fire is 40% contained',
        ContainmentPercent: 40,
        CreatedByUserId: 'user-1',
        CreatedOn: '2026-07-01T11:00:00Z',
        DeletedOn: null,
        ModifiedOn: null,
      },
    ],
    Attachments: [
      {
        IncidentAttachmentId: 'att-1',
        IncidentCommandId: 'ic-1',
        DepartmentId: 1,
        CallId: 123,
        Visibility: 0,
        FileName: 'preplan.pdf',
        ContentType: 'application/pdf',
        ContentLength: 2048,
        Description: null,
        UploadedByUserId: 'user-1',
        UploadedOn: '2026-07-01T10:30:00Z',
        DeletedOn: null,
        ModifiedOn: null,
      },
    ],
    MyAssignment: {
      ResourceAssignmentId: 'ra-1',
      CommandStructureNodeId: 'node-1',
      LaneName: 'Fire Attack',
      NodeType: 1,
      Color: '#FF0000',
      AssignedOn: '2026-07-01T10:05:00Z',
      PrimaryLead: { UserId: 'user-2', Name: 'Capt. Jones', Phone: '555-5678', Email: 'jones@example.com' },
      SecondaryLead: { UserId: 'user-3', Name: 'Lt. Brown', Phone: null, Email: null },
      PrimaryObjective: {
        TacticalObjectiveId: 'obj-2',
        IncidentCommandId: 'ic-1',
        DepartmentId: 1,
        CallId: 123,
        Name: 'Knock down fire',
        ObjectiveType: 0,
        Status: 2,
        AutoPopulated: false,
        CompletedByUserId: null,
        CompletedOn: null,
        Description: null,
        ProgressPercent: 25,
        Priority: 1,
        TargetCompleteOn: null,
        SortOrder: 0,
        ModifiedOn: null,
      },
      SecondaryObjective: null,
      LinkedNeed: {
        IncidentNeedId: 'need-2',
        IncidentCommandId: 'ic-1',
        DepartmentId: 1,
        CallId: 123,
        Name: 'Extra hose lines',
        Description: null,
        Category: 3,
        Status: 0,
        QuantityRequested: 0,
        QuantityFulfilled: 0,
        Priority: 1,
        CreatedByUserId: null,
        CreatedOn: '2026-07-01T10:20:00Z',
        MetByUserId: null,
        MetOn: null,
        SortOrder: 0,
        ModifiedOn: null,
      },
    },
    ...overrides,
  }) as ResourceIncidentView;

describe('IncidentCommandTabPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      view: null,
      isLoading: false,
      error: null,
      fetchIncidentView: mockFetchIncidentView,
    };
  });

  it('should fetch the incident view on mount with the call id', () => {
    const { unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(mockFetchIncidentView).toHaveBeenCalledWith('call123');

    unmount();
  });

  it('should render the loading state', () => {
    mockStoreState.isLoading = true;

    const { getByTestId, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(getByTestId('incident-command-loading')).toBeTruthy();

    unmount();
  });

  it('should render the error state', () => {
    mockStoreState.error = 'Something went wrong';

    const { getByTestId, getByText, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(getByTestId('incident-command-error')).toBeTruthy();
    expect(getByText('incident_command.error')).toBeTruthy();

    unmount();
  });

  it('should render the empty state when no incident command is active', () => {
    const { getByTestId, getByText, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(getByTestId('incident-command-empty')).toBeTruthy();
    expect(getByText('incident_command.no_active_command')).toBeTruthy();

    unmount();
  });

  it('should render the unit assignment card with lane, leads, objectives and linked need', () => {
    mockStoreState.view = createMockView();

    const { getByTestId, getByText, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(getByTestId('incident-command-assignment-card')).toBeTruthy();
    expect(getByText('Fire Attack')).toBeTruthy();
    expect(getByText('Capt. Jones')).toBeTruthy();
    expect(getByText('Lt. Brown')).toBeTruthy();
    expect(getByText('Knock down fire')).toBeTruthy();
    expect(getByText('Extra hose lines')).toBeTruthy();

    unmount();
  });

  it('should not render the assignment card when there is no assignment', () => {
    mockStoreState.view = createMockView({ MyAssignment: null });

    const { queryByTestId, getByTestId, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(queryByTestId('incident-command-assignment-card')).toBeNull();
    expect(getByTestId('incident-command-info-card')).toBeTruthy();

    unmount();
  });

  it('should render the incident info card with commander, important information and action plan', () => {
    mockStoreState.view = createMockView();

    const { getByTestId, getByText, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(getByTestId('incident-command-info-card')).toBeTruthy();
    expect(getByText('Chief Smith')).toBeTruthy();
    expect(getByTestId('incident-command-important-information')).toBeTruthy();
    expect(getByText('Watch for downed power lines')).toBeTruthy();
    expect(getByText('Attack from the north side')).toBeTruthy();

    unmount();
  });

  it('should render objectives, needs, notes and attachments', () => {
    mockStoreState.view = createMockView();

    const { getByText, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(getByText('Primary search')).toBeTruthy();
    expect(getByText('Water tenders')).toBeTruthy();
    expect(getByText('incident_command.quantity_fulfilled')).toBeTruthy();
    expect(getByText('Situation update')).toBeTruthy();
    expect(getByText('Fire is 40% contained')).toBeTruthy();
    expect(getByText('preplan.pdf')).toBeTruthy();
    expect(getByText('2.0 KB')).toBeTruthy();

    unmount();
  });

  it('should open the dialer when a contact phone number is pressed', () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    mockStoreState.view = createMockView();

    const { getByTestId, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    fireEvent.press(getByTestId('incident-command-primary-lead-phone'));
    expect(openUrlSpy).toHaveBeenCalledWith('tel:555-5678');

    openUrlSpy.mockRestore();
    unmount();
  });

  it('should open the mail client when a contact email is pressed', () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    mockStoreState.view = createMockView();

    const { getByTestId, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    fireEvent.press(getByTestId('incident-command-commander-email'));
    expect(openUrlSpy).toHaveBeenCalledWith('mailto:chief@example.com');

    openUrlSpy.mockRestore();
    unmount();
  });

  it('should render list empty states when the incident has no objectives, needs, notes or attachments', () => {
    mockStoreState.view = createMockView({
      Objectives: [],
      Needs: [],
      Notes: [],
      Attachments: [],
      MyAssignment: null,
    });

    const { getByText, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(getByText('incident_command.no_objectives')).toBeTruthy();
    expect(getByText('incident_command.no_needs')).toBeTruthy();
    expect(getByText('incident_command.no_notes')).toBeTruthy();
    expect(getByText('incident_command.no_attachments')).toBeTruthy();

    unmount();
  });

  it('should hide deleted notes and attachments', () => {
    const view = createMockView();
    view.Notes[0].DeletedOn = '2026-07-01T12:00:00Z';
    view.Attachments[0].DeletedOn = '2026-07-01T12:00:00Z';
    mockStoreState.view = view;

    const { getByText, queryByText, unmount } = render(<IncidentCommandTabPanel callId="call123" />);

    expect(queryByText('Situation update')).toBeNull();
    expect(queryByText('preplan.pdf')).toBeNull();
    expect(getByText('incident_command.no_notes')).toBeTruthy();
    expect(getByText('incident_command.no_attachments')).toBeTruthy();

    unmount();
  });
});
