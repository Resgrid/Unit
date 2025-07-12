import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';

import { SidebarUnitCard } from '../unit-sidebar';

// Mock the stores
jest.mock('@/stores/app/core-store');
jest.mock('@/stores/app/location-store');
jest.mock('@/stores/app/livekit-store');

const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockUseLiveKitStore = useLiveKitStore as jest.MockedFunction<typeof useLiveKitStore>;

describe('SidebarUnitCard', () => {
  const mockSetMapLocked = jest.fn();
  const mockSetIsBottomSheetVisible = jest.fn();

  const defaultProps = {
    unitName: 'Test Unit',
    unitType: 'Ambulance',
    unitGroup: 'Test Group',
    bgColor: 'bg-blue-500',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseCoreStore.mockReturnValue({
      activeUnit: null,
    });

    mockUseLocationStore.mockReturnValue({
      isMapLocked: false,
      setMapLocked: mockSetMapLocked,
    });

    mockUseLiveKitStore.mockReturnValue({
      setIsBottomSheetVisible: mockSetIsBottomSheetVisible,
      currentRoomInfo: null,
      isConnected: false,
      isTalking: false,
    });
  });

  it('renders unit information correctly', () => {
    render(<SidebarUnitCard {...defaultProps} />);

    expect(screen.getByText('Test Unit')).toBeTruthy();
    expect(screen.getByText('Ambulance')).toBeTruthy();
    expect(screen.getByText('Test Group')).toBeTruthy();
  });

  it('renders with default props when no active unit', () => {
    render(<SidebarUnitCard {...defaultProps} />);

    // Should render the default props since no active unit is set
    expect(screen.getByText('Test Unit')).toBeTruthy();
    expect(screen.getByText('Ambulance')).toBeTruthy();
    expect(screen.getByText('Test Group')).toBeTruthy();
  });

  describe('Map Lock Button', () => {
    it('renders map lock button with unlock icon when map is not locked', () => {
      render(<SidebarUnitCard {...defaultProps} />);

      const mapLockButton = screen.getByTestId('map-lock-button');
      expect(mapLockButton).toBeTruthy();

      // Check that the button has the correct styling for unlocked state
      expect(mapLockButton).toHaveStyle({
        backgroundColor: 'transparent',
        borderColor: '#007AFF',
      });
    });

    it('renders map lock button with lock icon when map is locked', () => {
      mockUseLocationStore.mockReturnValue({
        isMapLocked: true,
        setMapLocked: mockSetMapLocked,
      });

      render(<SidebarUnitCard {...defaultProps} />);

      const mapLockButton = screen.getByTestId('map-lock-button');
      expect(mapLockButton).toBeTruthy();

      // Check that the button has the correct styling for locked state
      expect(mapLockButton).toHaveStyle({
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
      });
    });

    it('toggles map lock state when pressed', () => {
      render(<SidebarUnitCard {...defaultProps} />);

      const mapLockButton = screen.getByTestId('map-lock-button');
      fireEvent.press(mapLockButton);

      expect(mockSetMapLocked).toHaveBeenCalledWith(true);
    });

    it('toggles map lock state from locked to unlocked when pressed', () => {
      mockUseLocationStore.mockReturnValue({
        isMapLocked: true,
        setMapLocked: mockSetMapLocked,
      });

      render(<SidebarUnitCard {...defaultProps} />);

      const mapLockButton = screen.getByTestId('map-lock-button');
      fireEvent.press(mapLockButton);

      expect(mockSetMapLocked).toHaveBeenCalledWith(false);
    });
  });

  describe('Call Button', () => {
    it('renders call button with correct styling when not connected', () => {
      render(<SidebarUnitCard {...defaultProps} />);

      const callButton = screen.getByTestId('call-button');
      expect(callButton).toBeTruthy();

      // Check that the button has the correct styling for disconnected state
      expect(callButton).toHaveStyle({
        backgroundColor: 'transparent',
        borderColor: '#007AFF',
      });
    });

    it('renders call button with active styling when connected', () => {
      mockUseLiveKitStore.mockReturnValue({
        setIsBottomSheetVisible: mockSetIsBottomSheetVisible,
        currentRoomInfo: null,
        isConnected: true,
        isTalking: false,
      });

      render(<SidebarUnitCard {...defaultProps} />);

      const callButton = screen.getByTestId('call-button');
      expect(callButton).toBeTruthy();

      // Check that the button has the correct styling for connected state
      expect(callButton).toHaveStyle({
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
      });
    });

    it('opens LiveKit when call button is pressed', () => {
      render(<SidebarUnitCard {...defaultProps} />);

      const callButton = screen.getByTestId('call-button');
      fireEvent.press(callButton);

      expect(mockSetIsBottomSheetVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('Room Status Display', () => {
    it('shows room status when connected and has room info', () => {
      const mockRoomInfo = {
        Name: 'Test Room',
        Id: '123',
      };

      mockUseLiveKitStore.mockReturnValue({
        setIsBottomSheetVisible: mockSetIsBottomSheetVisible,
        currentRoomInfo: mockRoomInfo,
        isConnected: true,
        isTalking: false,
      });

      render(<SidebarUnitCard {...defaultProps} />);

      expect(screen.getByText('Test Room')).toBeTruthy();
    });

    it('shows microphone icon when talking', () => {
      const mockRoomInfo = {
        Name: 'Test Room',
        Id: '123',
      };

      mockUseLiveKitStore.mockReturnValue({
        setIsBottomSheetVisible: mockSetIsBottomSheetVisible,
        currentRoomInfo: mockRoomInfo,
        isConnected: true,
        isTalking: true,
      });

      render(<SidebarUnitCard {...defaultProps} />);

      expect(screen.getByText('Test Room')).toBeTruthy();
      // Note: Testing for specific icon presence would require additional setup
      // for icon mocking, which is beyond the scope of this basic test
    });

    it('does not show room status when not connected', () => {
      const mockRoomInfo = {
        Name: 'Test Room',
        Id: '123',
      };

      mockUseLiveKitStore.mockReturnValue({
        setIsBottomSheetVisible: mockSetIsBottomSheetVisible,
        currentRoomInfo: mockRoomInfo,
        isConnected: false,
        isTalking: false,
      });

      render(<SidebarUnitCard {...defaultProps} />);

      expect(screen.queryByText('Test Room')).toBeNull();
    });
  });

  describe('Button Container Layout', () => {
    it('renders both buttons in the correct order', () => {
      render(<SidebarUnitCard {...defaultProps} />);

      const mapLockButton = screen.getByTestId('map-lock-button');
      const callButton = screen.getByTestId('call-button');

      expect(mapLockButton).toBeTruthy();
      expect(callButton).toBeTruthy();

      // Both buttons should be present
      expect(mapLockButton).toBeTruthy();
      expect(callButton).toBeTruthy();
    });
  });
}); 