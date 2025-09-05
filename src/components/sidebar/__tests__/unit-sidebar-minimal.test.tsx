import { render } from '@testing-library/react-native';
import React from 'react';

// Mock Platform first before any other imports
const mockPlatform = {
  OS: 'ios' as const,
  select: jest.fn().mockImplementation((obj: any) => obj.ios || obj.default),
  Version: 17,
  constants: {},
  isTesting: true,
};

// Mock react-native Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => mockPlatform);

// Mock react-native-svg to avoid Platform.OS issues
jest.mock('react-native-svg', () => {
  const React = require('react');
  const Svg = React.forwardRef((props: any, ref: any) => React.createElement('View', { ...props, ref, testID: 'mock-svg' }));
  const Circle = (props: any) => React.createElement('View', { ...props, testID: 'mock-circle' });
  const Path = (props: any) => React.createElement('View', { ...props, testID: 'mock-path' });
  const G = (props: any) => React.createElement('View', { ...props, testID: 'mock-g' });
  const Line = (props: any) => React.createElement('View', { ...props, testID: 'mock-line' });
  const Polyline = (props: any) => React.createElement('View', { ...props, testID: 'mock-polyline' });
  const Polygon = (props: any) => React.createElement('View', { ...props, testID: 'mock-polygon' });
  const Rect = (props: any) => React.createElement('View', { ...props, testID: 'mock-rect' });

  return {
    __esModule: true,
    default: Svg,
    Svg,
    Circle,
    Path,
    G,
    Line,
    Polyline,
    Polygon,
    Rect,
  };
});

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return {
    Lock: (props: any) => React.createElement('View', { ...props, testID: 'mock-lock-icon' }),
    Mic: (props: any) => React.createElement('View', { ...props, testID: 'mock-mic-icon' }),
    Phone: (props: any) => React.createElement('View', { ...props, testID: 'mock-phone-icon' }),
    Radio: (props: any) => React.createElement('View', { ...props, testID: 'mock-radio-icon' }),
    Unlock: (props: any) => React.createElement('View', { ...props, testID: 'mock-unlock-icon' }),
  };
});

// Mock all stores inline
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(() => ({ activeUnit: null })),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn(() => ({ isMapLocked: false, setMapLocked: jest.fn() })),
}));

jest.mock('@/stores/app/livekit-store', () => ({
  useLiveKitStore: jest.fn(() => ({
    setIsBottomSheetVisible: jest.fn(),
    currentRoomInfo: null,
    isConnected: false,
    isTalking: false,
  })),
}));

jest.mock('@/stores/app/audio-stream-store', () => ({
  useAudioStreamStore: jest.fn(() => ({
    setIsBottomSheetVisible: jest.fn(),
    currentStream: null,
    isPlaying: false,
  })),
}));

jest.mock('@/components/audio-stream/audio-stream-bottom-sheet', () => ({
  AudioStreamBottomSheet: () => null,
}));

// Test if we can import the component
describe('SidebarUnitCard - Import Test', () => {
  it('should be able to import the component', () => {
    const SidebarUnitCard = require('../unit-sidebar').SidebarUnitCard;
    expect(SidebarUnitCard).toBeDefined();
  });

  it('should render the component with default props', () => {
    const { SidebarUnitCard } = require('../unit-sidebar');
    const { getByText } = render(
      <SidebarUnitCard
        unitName="Test Unit"
        unitType="Engine"
        unitGroup="Station 1"
        bgColor="bg-white"
      />
    );

    expect(getByText('Test Unit')).toBeTruthy();
    expect(getByText('Engine')).toBeTruthy();
    expect(getByText('Station 1')).toBeTruthy();
  });

  it('should render buttons with proper test IDs', () => {
    const { SidebarUnitCard } = require('../unit-sidebar');
    const { getByTestId } = render(
      <SidebarUnitCard
        unitName="Test Unit"
        unitType="Engine"
        unitGroup="Station 1"
        bgColor="bg-white"
      />
    );

    expect(getByTestId('map-lock-button')).toBeTruthy();
    expect(getByTestId('audio-stream-button')).toBeTruthy();
    expect(getByTestId('call-button')).toBeTruthy();
  });
});
