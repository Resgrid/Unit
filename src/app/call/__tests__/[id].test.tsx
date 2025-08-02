import { render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { useWindowDimensions } from 'react-native';

import { useAnalytics } from '@/hooks/use-analytics';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';

import CallDetail from '../[id]';



// Mock UI components that might use NativeWind
jest.mock('@/components/ui', () => ({
  FocusAwareStatusBar: jest.fn().mockImplementation(() => null),
  SafeAreaView: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/box', () => ({
  Box: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/button', () => ({
  Button: jest.fn().mockImplementation(({ children }) => children),
  ButtonIcon: jest.fn().mockImplementation(() => null),
  ButtonText: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/shared-tabs', () => ({
  SharedTabs: jest.fn().mockImplementation(() => null),
}));

jest.mock('@/components/ui/text', () => ({
  Text: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: jest.fn().mockImplementation(({ children }) => children),
}));

// Type the mock
const mockUseWindowDimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

// Mock all the dependencies
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({
    back: jest.fn(),
    push: jest.fn(),
  })),
}));

// Mock Lucide React Native icons
jest.mock('lucide-react-native', () => ({
  ClockIcon: 'ClockIcon',
  FileTextIcon: 'FileTextIcon',
  ImageIcon: 'ImageIcon',
  InfoIcon: 'InfoIcon',
  PaperclipIcon: 'PaperclipIcon',
  RouteIcon: 'RouteIcon',
  UserIcon: 'UserIcon',
  UsersIcon: 'UsersIcon',
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Path: 'Path',
  G: 'G',
  Circle: 'Circle',
  Rect: 'Rect',
  default: 'Svg',
  SvgXml: 'SvgXml',
  __esModule: true,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn(() => '2024-01-01 12:00'),
}));

// Mock react-native-webview
jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: 'WebView',
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: jest.fn(),
}));

jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: jest.fn(),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn(),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn(),
}));

jest.mock('../../../components/calls/call-detail-menu', () => ({
  useCallDetailMenu: jest.fn(() => ({
    HeaderRightMenu: () => null,
    CallDetailActionSheet: () => null,
  })),
}));

jest.mock('../../../components/calls/call-files-modal', () => {
  return function CallFilesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/call-images-modal', () => {
  return function CallImagesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/call-notes-modal', () => {
  return function CallNotesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/close-call-bottom-sheet', () => ({
  CloseCallBottomSheet: () => null,
}));

jest.mock('@/components/maps/static-map', () => {
  return function StaticMap() {
    return null;
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// React Native mocks
jest.mock('react-native', () => ({
  View: jest.fn().mockImplementation(({ children, ...props }) => children),
  Text: jest.fn().mockImplementation(({ children }) => children),
  ScrollView: jest.fn().mockImplementation(({ children }) => children),
  ActivityIndicator: jest.fn().mockImplementation(() => null),
  StatusBar: {
    setBackgroundColor: jest.fn(),
    setTranslucent: jest.fn(),
    setBarStyle: jest.fn(),
    setHidden: jest.fn(),
  },
  useWindowDimensions: jest.fn(() => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
  })),
  Dimensions: {
    get: jest.fn(() => ({
      width: 375,
      height: 812,
      scale: 3,
      fontScale: 1,
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn(options => options.ios),
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(style => style),
  },
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addEventListener: jest.fn((eventType, callback) => ({
      remove: jest.fn()
    })),
    addChangeListener: jest.fn((callback) => ({
      remove: jest.fn()
    })),
    removeChangeListener: jest.fn(),
    isReduceMotionEnabled: jest.fn(() => false),
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
    addEventListener: jest.fn((eventType, callback) => ({
      remove: jest.fn()
    })),
    removeEventListener: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock Aptabase
jest.mock('@aptabase/react-native', () => ({
  trackEvent: jest.fn(),
  init: jest.fn(),
  dispose: jest.fn(),
  AptabaseProvider: ({ children }: { children: React.ReactNode }) => children,
  useAptabase: () => ({
    trackEvent: jest.fn(),
  }),
}));

// Mock Expo HTML elements
jest.mock('@expo/html-elements', () => ({
  H1: ({ children, ...props }: any) => children,
  H2: ({ children, ...props }: any) => children,
  H3: ({ children, ...props }: any) => children,
  H4: ({ children, ...props }: any) => children,
  H5: ({ children, ...props }: any) => children,
  H6: ({ children, ...props }: any) => children,
}));

// Mock Expo Navigation Bar
jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn(),
  setVisibilityAsync: jest.fn(),
  setBehaviorAsync: jest.fn(),
  getBackgroundColorAsync: jest.fn(),
  getVisibilityAsync: jest.fn(),
  getBehaviorAsync: jest.fn(),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(),
}));

// Mock react-native-edge-to-edge
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: {
    setHidden: jest.fn(),
    setColor: jest.fn(),
    setStyle: jest.fn(),
  },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const MockedSafeAreaView = ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('div', props, children);
  };
  MockedSafeAreaView.displayName = 'SafeAreaView';

  return {
    SafeAreaView: MockedSafeAreaView,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

const mockTrackEvent = jest.fn();
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const mockUseCallDetailStore = useCallDetailStore as jest.MockedFunction<typeof useCallDetailStore>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockUseToastStore = useToastStore as jest.MockedFunction<typeof useToastStore>;

describe('CallDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAnalytics.mockReturnValue({
      trackEvent: mockTrackEvent,
    });

    mockUseLocalSearchParams.mockReturnValue({
      id: 'test-call-id',
    });

    mockUseLocationStore.mockReturnValue({
      latitude: 40.7128,
      longitude: -74.0060,
    });

    mockUseToastStore.mockReturnValue(jest.fn());

    mockUseCallDetailStore.mockReturnValue({
      call: null,
      callExtraData: null,
      callPriority: null,
      isLoading: true,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });
  });

  it('should track analytics when call detail view is rendered with call data', async () => {
    const mockCall = {
      CallId: 'test-call-id',
      Name: 'Test Call',
      Number: 'C2024001',
      Priority: 2,
      Type: 'Emergency',
      Address: '123 Main St',
      Latitude: '40.7128',
      Longitude: '-74.0060',
      NotesCount: 3,
      ImgagesCount: 2,
      FileCount: 1,
    };

    const mockCallExtraData = {
      Protocols: [{ Name: 'Protocol 1' }],
      Dispatches: [{ Name: 'Unit 1' }],
      Activity: [{ StatusText: 'Dispatched' }],
    };

    mockUseCallDetailStore.mockReturnValue({
      call: mockCall,
      callExtraData: mockCallExtraData,
      callPriority: { Name: 'High', Color: '#ff0000' },
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });

    render(<CallDetail />);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('call_detail_view_rendered', {
        callId: 'test-call-id',
        callName: 'Test Call',
        callNumber: 'C2024001',
        callPriority: 2,
        callType: 'Emergency',
        hasCoordinates: true,
        hasAddress: true,
        hasNotes: true,
        hasImages: true,
        hasFiles: true,
        hasExtraData: true,
        hasProtocols: true,
        hasDispatches: true,
        hasTimeline: true,
      });
    });
  });

  it('should not track analytics when call data is not available', () => {
    mockUseCallDetailStore.mockReturnValue({
      call: null,
      callExtraData: null,
      callPriority: null,
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });

    render(<CallDetail />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('should track analytics with default values when call has missing data', async () => {
    const mockCall = {
      CallId: '',
      Name: '',
      Number: '',
      Priority: 0,
      Type: '',
      Address: '',
      Latitude: null,
      Longitude: null,
      NotesCount: 0,
      ImgagesCount: 0,
      FileCount: 0,
    };

    mockUseCallDetailStore.mockReturnValue({
      call: mockCall,
      callExtraData: null,
      callPriority: null,
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });

    render(<CallDetail />);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('call_detail_view_rendered', {
        callId: '',
        callName: '',
        callNumber: '',
        callPriority: 0,
        callType: '',
        hasCoordinates: false,
        hasAddress: false,
        hasNotes: false,
        hasImages: false,
        hasFiles: false,
        hasExtraData: false,
        hasProtocols: false,
        hasDispatches: false,
        hasTimeline: false,
      });
    });
  });
});
