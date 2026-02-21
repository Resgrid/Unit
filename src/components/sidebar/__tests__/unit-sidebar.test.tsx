import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

// Mock @livekit/react-native-webrtc before any imports that use it
jest.mock('@livekit/react-native-webrtc', () => ({
  RTCAudioSession: {
    configure: jest.fn().mockResolvedValue(undefined),
    setCategory: jest.fn().mockResolvedValue(undefined),
    setMode: jest.fn().mockResolvedValue(undefined),
    getActiveAudioSession: jest.fn().mockReturnValue(null),
    setActive: jest.fn().mockResolvedValue(undefined),
  },
}));

import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';
import { useAudioStreamStore } from '@/stores/app/audio-stream-store';

// Mock the stores
jest.mock('@/stores/app/core-store');
jest.mock('@/stores/app/location-store');
jest.mock('@/stores/app/livekit-store');
jest.mock('@/stores/app/audio-stream-store');

jest.mock('@/components/audio-stream/audio-stream-bottom-sheet', () => ({
  AudioStreamBottomSheet: () => null,
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  Lock: () => null,
  Unlock: () => null,
  Phone: () => null,
  Radio: () => null,
  Mic: () => null,
}));

const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockUseLiveKitStore = useLiveKitStore as jest.MockedFunction<typeof useLiveKitStore>;
const mockUseAudioStreamStore = useAudioStreamStore as jest.MockedFunction<typeof useAudioStreamStore>;

// Import component after mocks
import { SidebarUnitCard } from '../unit-sidebar';

describe('SidebarUnitCard', () => {
  const defaultProps = {
    unitName: 'Test Unit',
    unitType: 'Ambulance',
    unitGroup: 'Test Group',
    bgColor: 'bg-blue-500',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset to default mocks
    mockUseCoreStore.mockImplementation((selector) => selector({ activeUnit: null } as any));
    mockUseLocationStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({ isMapLocked: false, setMapLocked: jest.fn() }) : { isMapLocked: false, setMapLocked: jest.fn() });
    mockUseLiveKitStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({
      setIsBottomSheetVisible: jest.fn(),
      ensureMicrophonePermission: jest.fn().mockResolvedValue(true),
      currentRoomInfo: null,
      isConnected: false,
      isTalking: false,
    }) : {
      setIsBottomSheetVisible: jest.fn(),
      ensureMicrophonePermission: jest.fn().mockResolvedValue(true),
      currentRoomInfo: null,
      isConnected: false,
      isTalking: false,
    });
    mockUseAudioStreamStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({
      setIsBottomSheetVisible: jest.fn(),
      currentStream: null,
      isPlaying: false,
    }) : {
      setIsBottomSheetVisible: jest.fn(),
      currentStream: null,
      isPlaying: false,
    });
  });

  it('renders unit information correctly with default props', () => {
    render(<SidebarUnitCard {...defaultProps} />);

    expect(screen.getByText('Test Unit')).toBeTruthy();
    expect(screen.getByText('Ambulance')).toBeTruthy();
    expect(screen.getByText('Test Group')).toBeTruthy();
  });

  it('renders active unit information when available', () => {
    const mockActiveUnit = {
      Name: 'Active Unit Name',
      Type: 'Fire Truck',
      GroupName: 'Fire Department',
    } as any;

    mockUseCoreStore.mockImplementation((selector) => selector({ activeUnit: mockActiveUnit } as any));

    render(<SidebarUnitCard {...defaultProps} />);

    expect(screen.getByText('Active Unit Name')).toBeTruthy();
    expect(screen.getByText('Fire Truck')).toBeTruthy();
    expect(screen.getByText('Fire Department')).toBeTruthy();
  });

  it('renders action buttons', () => {
    render(<SidebarUnitCard {...defaultProps} />);

    expect(screen.getByTestId('map-lock-button')).toBeTruthy();
    expect(screen.getByTestId('audio-stream-button')).toBeTruthy();
    expect(screen.getByTestId('call-button')).toBeTruthy();
  });

  it('handles map lock button press', () => {
    const mockSetMapLocked = jest.fn();
    mockUseLocationStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({
      isMapLocked: false,
      setMapLocked: mockSetMapLocked
    }) : {
      isMapLocked: false,
      setMapLocked: mockSetMapLocked
    });

    render(<SidebarUnitCard {...defaultProps} />);

    const mapLockButton = screen.getByTestId('map-lock-button');
    fireEvent.press(mapLockButton);

    expect(mockSetMapLocked).toHaveBeenCalledWith(true);
  });

  it('handles audio stream button press', () => {
    const mockSetAudioStreamBottomSheetVisible = jest.fn();
    mockUseAudioStreamStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({
      setIsBottomSheetVisible: mockSetAudioStreamBottomSheetVisible,
      currentStream: null,
      isPlaying: false,
    }) : {
      setIsBottomSheetVisible: mockSetAudioStreamBottomSheetVisible,
      currentStream: null,
      isPlaying: false,
    });

    render(<SidebarUnitCard {...defaultProps} />);

    const audioStreamButton = screen.getByTestId('audio-stream-button');
    fireEvent.press(audioStreamButton);

    expect(mockSetAudioStreamBottomSheetVisible).toHaveBeenCalledWith(true);
  });

  it('handles call button press', async () => {
    const mockSetIsBottomSheetVisible = jest.fn();
    const mockEnsureMicrophonePermission = jest.fn().mockResolvedValue(true);
    mockUseLiveKitStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({
      setIsBottomSheetVisible: mockSetIsBottomSheetVisible,
      ensureMicrophonePermission: mockEnsureMicrophonePermission,
      currentRoomInfo: null,
      isConnected: false,
      isTalking: false,
    }) : {
      setIsBottomSheetVisible: mockSetIsBottomSheetVisible,
      ensureMicrophonePermission: mockEnsureMicrophonePermission,
      currentRoomInfo: null,
      isConnected: false,
      isTalking: false,
    });

    render(<SidebarUnitCard {...defaultProps} />);

    const callButton = screen.getByTestId('call-button');
    await fireEvent.press(callButton);

    expect(mockEnsureMicrophonePermission).toHaveBeenCalled();
    expect(mockSetIsBottomSheetVisible).toHaveBeenCalledWith(true);
  });

  it('shows room status when connected', () => {
    const mockRoomInfo = { Name: 'Emergency Call Room' };
    mockUseLiveKitStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({
      setIsBottomSheetVisible: jest.fn(),
      ensureMicrophonePermission: jest.fn().mockResolvedValue(true),
      currentRoomInfo: mockRoomInfo as any,
      isConnected: true,
      isTalking: false,
    }) : {
      setIsBottomSheetVisible: jest.fn(),
      ensureMicrophonePermission: jest.fn().mockResolvedValue(true),
      currentRoomInfo: mockRoomInfo as any,
      isConnected: true,
      isTalking: false,
    });

    render(<SidebarUnitCard {...defaultProps} />);

    expect(screen.getByText('Emergency Call Room')).toBeTruthy();
  });

  it('toggles map lock correctly when currently locked', () => {
    const mockSetMapLocked = jest.fn();
    mockUseLocationStore.mockImplementation((selector: any) => typeof selector === 'function' ? selector({
      isMapLocked: true,
      setMapLocked: mockSetMapLocked
    }) : {
      isMapLocked: true,
      setMapLocked: mockSetMapLocked
    });

    render(<SidebarUnitCard {...defaultProps} />);

    const mapLockButton = screen.getByTestId('map-lock-button');
    fireEvent.press(mapLockButton);

    expect(mockSetMapLocked).toHaveBeenCalledWith(false);
  });
}); 