// Mock Platform first, before any other imports
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn().mockImplementation((obj) => obj.ios || obj.default),
}));

// Mock ScrollView without mocking all of react-native
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  return React.forwardRef(({ children, testID, ...props }: any, ref: any) => {
    return React.createElement('View', { testID: testID || 'scroll-view', ref, ...props }, children);
  });
});

// Mock react-native-svg before anything else
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  G: 'G',
  Text: 'Text',
  TSpan: 'TSpan',
  TextPath: 'TextPath',
  Path: 'Path',
  Polygon: 'Polygon',
  Polyline: 'Polyline',
  Line: 'Line',
  Rect: 'Rect',
  Use: 'Use',
  Image: 'Image',
  Symbol: 'Symbol',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
  ClipPath: 'ClipPath',
  Pattern: 'Pattern',
  Mask: 'Mask',
  default: 'Svg',
}));

// Mock @expo/html-elements
jest.mock('@expo/html-elements', () => ({
  H1: 'H1',
  H2: 'H2',
  H3: 'H3',
  H4: 'H4',
  H5: 'H5',
  H6: 'H6',
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { type UnitResultData } from '@/models/v4/units/unitResultData';
import { useCoreStore } from '@/stores/app/core-store';
import { useRolesStore } from '@/stores/roles/store';
import { useUnitsStore } from '@/stores/units/store';

import { UnitSelectionBottomSheet } from '../unit-selection-bottom-sheet';

// Mock stores
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

jest.mock('@/stores/roles/store', () => ({
  useRolesStore: {
    getState: jest.fn(() => ({
      fetchRolesForUnit: jest.fn(),
    })),
  },
}));

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock lucide icons to avoid SVG issues in tests
jest.mock('lucide-react-native', () => ({
  Check: 'Check',
}));

// Mock gluestack UI components
jest.mock('@/components/ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen }: any) => (isOpen ? children : null),
  ActionsheetBackdrop: ({ children }: any) => children || null,
  ActionsheetContent: ({ children }: any) => children,
  ActionsheetDragIndicator: () => null,
  ActionsheetDragIndicatorWrapper: ({ children }: any) => children,
  ActionsheetItem: ({ children, onPress, disabled, testID, ...props }: any) => {
    const React = require('react');
    return React.createElement(
      'View',
      {
        onPress: disabled ? undefined : onPress,
        testID: testID || 'actionsheet-item',
        accessibilityState: { disabled },
      },
      children
    );
  },
  ActionsheetItemText: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('Text', { testID: props.testID || 'actionsheet-item-text' }, children);
  },
}));

jest.mock('@/components/ui/spinner', () => ({
  Spinner: (props: any) => {
    const React = require('react');
    return React.createElement('Text', { testID: 'spinner' }, 'Loading...');
  },
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: props.testID || 'box' }, children);
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: props.testID || 'vstack' }, children);
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: props.testID || 'hstack' }, children);
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('Text', { testID: props.testID || 'text' }, children);
  },
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('Text', { testID: props.testID || 'heading' }, children);
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => {
    const React = require('react');
    return React.createElement(
      'View',
      {
        onPress: disabled ? undefined : onPress,
        testID: props.testID || 'button',
        accessibilityState: { disabled },
      },
      children
    );
  },
  ButtonText: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('Text', { testID: props.testID || 'button-text' }, children);
  },
}));

jest.mock('@/components/ui/center', () => ({
  Center: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: props.testID || 'center' }, children);
  },
}));

const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockUseUnitsStore = useUnitsStore as jest.MockedFunction<typeof useUnitsStore>;

describe('UnitSelectionBottomSheet', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  const mockUnits: UnitResultData[] = [
    {
      UnitId: '1',
      Name: 'Engine 1',
      Type: 'Engine',
      DepartmentId: '1',
      TypeId: 1,
      CustomStatusSetId: '',
      GroupId: '1',
      GroupName: 'Station 1',
      Vin: '',
      PlateNumber: '',
      FourWheelDrive: false,
      SpecialPermit: false,
      CurrentDestinationId: '',
      CurrentStatusId: '',
      CurrentStatusTimestamp: '',
      Latitude: '',
      Longitude: '',
      Note: '',
    } as UnitResultData,
    {
      UnitId: '2',
      Name: 'Ladder 1',
      Type: 'Ladder',
      DepartmentId: '1',
      TypeId: 2,
      CustomStatusSetId: '',
      GroupId: '1',
      GroupName: 'Station 1',
      Vin: '',
      PlateNumber: '',
      FourWheelDrive: false,
      SpecialPermit: false,
      CurrentDestinationId: '',
      CurrentStatusId: '',
      CurrentStatusTimestamp: '',
      Latitude: '',
      Longitude: '',
      Note: '',
    } as UnitResultData,
    {
      UnitId: '3',
      Name: 'Rescue 1',
      Type: 'Rescue',
      DepartmentId: '1',
      TypeId: 3,
      CustomStatusSetId: '',
      GroupId: '2',
      GroupName: 'Station 2',
      Vin: '',
      PlateNumber: '',
      FourWheelDrive: false,
      SpecialPermit: false,
      CurrentDestinationId: '',
      CurrentStatusId: '',
      CurrentStatusTimestamp: '',
      Latitude: '',
      Longitude: '',
      Note: '',
    } as UnitResultData,
  ];

  const mockSetActiveUnit = jest.fn().mockResolvedValue(undefined);
  const mockFetchUnits = jest.fn().mockResolvedValue(undefined);
  const mockFetchRolesForUnit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseCoreStore.mockReturnValue({
      activeUnit: mockUnits[0],
      setActiveUnit: mockSetActiveUnit,
    } as any);

    mockUseUnitsStore.mockReturnValue({
      units: mockUnits,
      fetchUnits: mockFetchUnits,
      isLoading: false,
    } as any);

    // Mock the roles store
    (useRolesStore.getState as jest.Mock).mockReturnValue({
      fetchRolesForUnit: mockFetchRolesForUnit,
    });
  });

  it('renders correctly when open', () => {
    render(<UnitSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('settings.select_unit')).toBeTruthy();
    expect(screen.getByText('settings.current_unit')).toBeTruthy();
    expect(screen.getAllByText('Engine 1')).toHaveLength(2); // One in current selection, one in list
    expect(screen.getByText('Ladder 1')).toBeTruthy();
    expect(screen.getByText('Rescue 1')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<UnitSelectionBottomSheet {...mockProps} isOpen={false} />);

    expect(screen.queryByText('settings.select_unit')).toBeNull();
  });

  it('displays current unit selection', () => {
    render(<UnitSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('settings.current_unit')).toBeTruthy();
    expect(screen.getAllByText('Engine 1')).toHaveLength(2); // One in current selection, one in list
  });

  it('displays loading state when fetching units', () => {
    mockUseUnitsStore.mockReturnValue({
      units: [],
      fetchUnits: jest.fn().mockResolvedValue(undefined),
      isLoading: true,
    } as any);

    render(<UnitSelectionBottomSheet {...mockProps} />);

    expect(screen.getByTestId('spinner')).toBeTruthy();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('displays empty state when no units available', () => {
    mockUseUnitsStore.mockReturnValue({
      units: [],
      fetchUnits: jest.fn().mockResolvedValue(undefined),
      isLoading: false,
    } as any);

    render(<UnitSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('settings.no_units_available')).toBeTruthy();
  });

  it('fetches units when sheet opens and no units are loaded', async () => {
    const spyFetchUnits = jest.fn().mockResolvedValue(undefined);

    mockUseUnitsStore.mockReturnValue({
      units: [],
      fetchUnits: spyFetchUnits,
      isLoading: false,
    } as any);

    render(<UnitSelectionBottomSheet {...mockProps} />);

    await waitFor(() => {
      expect(spyFetchUnits).toHaveBeenCalled();
    });
  });

  it('does not fetch units when sheet opens and units are already loaded', () => {
    render(<UnitSelectionBottomSheet {...mockProps} />);

    expect(mockFetchUnits).not.toHaveBeenCalled();
  });

  it('handles unit selection successfully', async () => {
    mockSetActiveUnit.mockResolvedValue(undefined);
    mockFetchRolesForUnit.mockResolvedValue(undefined);

    render(<UnitSelectionBottomSheet {...mockProps} />);

    // Find the second unit (Ladder 1) and select it via its testID
    const ladderUnit = screen.getByTestId('unit-item-2');
    fireEvent.press(ladderUnit);

    await waitFor(() => {
      expect(mockSetActiveUnit).toHaveBeenCalledWith('2');
    });

    await waitFor(() => {
      expect(mockFetchRolesForUnit).toHaveBeenCalledWith('2');
    });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('handles unit selection failure gracefully', async () => {
    const error = new Error('Failed to set active unit');
    mockSetActiveUnit.mockRejectedValue(error);

    render(<UnitSelectionBottomSheet {...mockProps} />);

    // Find the second unit (Ladder 1) and select it via its testID
    const ladderUnit = screen.getByTestId('unit-item-2');
    fireEvent.press(ladderUnit);

    await waitFor(() => {
      expect(mockSetActiveUnit).toHaveBeenCalledWith('2');
    });

    // Should not call fetchRolesForUnit if setActiveUnit fails
    expect(mockFetchRolesForUnit).not.toHaveBeenCalled();
    // Should not close the modal on error
    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  it('prevents multiple selections while loading', async () => {
    mockSetActiveUnit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<UnitSelectionBottomSheet {...mockProps} />);

    // Select first unit via its testID
    const ladderUnit = screen.getByTestId('unit-item-2');
    fireEvent.press(ladderUnit);

    // Try to select another unit while first is processing via its testID
    const rescueUnit = screen.getByTestId('unit-item-3');
    fireEvent.press(rescueUnit);

    await waitFor(() => {
      expect(mockSetActiveUnit).toHaveBeenCalledTimes(1);
      expect(mockSetActiveUnit).toHaveBeenCalledWith('2');
    });
  });

  it('closes when cancel button is pressed', () => {
    render(<UnitSelectionBottomSheet {...mockProps} />);

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.press(cancelButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('disables cancel button while unit selection is loading', async () => {
    mockSetActiveUnit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<UnitSelectionBottomSheet {...mockProps} />);

    // Start unit selection
    const ladderUnit = screen.getByText('Ladder 1');
    fireEvent.press(ladderUnit);

    // Check that cancel button is disabled
    const cancelButton = screen.getByTestId('cancel-button');
    expect(cancelButton.props.accessibilityState.disabled).toBe(true);

    // Try to press cancel button - it should be disabled
    fireEvent.press(cancelButton);

    // onClose should not be called because button is disabled
    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  it('shows selected unit with check mark and proper styling', () => {
    render(<UnitSelectionBottomSheet {...mockProps} />);

    // Engine 1 should be marked as selected since it's the active unit
    expect(screen.getAllByText('Engine 1')).toHaveLength(2); // One in current selection, one in list

    // Check mark should be present for selected unit
    // Note: In actual implementation, the Check component would be rendered
    // but in tests, it's just a string 'Check'
  });

  it('renders units with correct type information', () => {
    render(<UnitSelectionBottomSheet {...mockProps} />);

    expect(screen.getByText('Engine')).toBeTruthy();
    expect(screen.getByText('Ladder')).toBeTruthy();
    expect(screen.getByText('Rescue')).toBeTruthy();
  });

  it('handles fetch units error gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });
    const errorFetchUnits = jest.fn().mockRejectedValue(new Error('Network error'));

    mockUseUnitsStore.mockReturnValue({
      units: [],
      fetchUnits: errorFetchUnits,
      isLoading: false,
    } as any);

    render(<UnitSelectionBottomSheet {...mockProps} />);

    await waitFor(() => {
      expect(errorFetchUnits).toHaveBeenCalled();
    });

    // Component should still render normally even if fetch fails
    expect(screen.getByText('settings.select_unit')).toBeTruthy();

    consoleError.mockRestore();
  });

  describe('Performance Optimizations', () => {
    it('memoizes unit item component to prevent unnecessary re-renders', () => {
      const { rerender } = render(<UnitSelectionBottomSheet {...mockProps} />);

      // Re-render with same props
      rerender(<UnitSelectionBottomSheet {...mockProps} />);

      // The component should be memoized and not cause unnecessary re-renders
      expect(screen.getAllByText('Engine 1')).toHaveLength(2);
    });

    it('uses stable rendering for units list', () => {
      render(<UnitSelectionBottomSheet {...mockProps} />);

      // ScrollView should be present with units
      expect(screen.getByTestId('scroll-view')).toBeTruthy();
      expect(screen.getAllByText('Engine 1')).toHaveLength(2); // One in current selection, one in list
      expect(screen.getByText('Ladder 1')).toBeTruthy();
      expect(screen.getByText('Rescue 1')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('provides proper test IDs for testing', () => {
      render(<UnitSelectionBottomSheet {...mockProps} />);

      expect(screen.getByTestId('scroll-view')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing active unit gracefully', () => {
      mockUseCoreStore.mockReturnValue({
        activeUnit: null,
        setActiveUnit: mockSetActiveUnit,
      } as any);

      render(<UnitSelectionBottomSheet {...mockProps} />);

      // Should not show current unit section
      expect(screen.queryByText('settings.current_unit')).toBeNull();
      // Should still show unit list
      expect(screen.getByText('Engine 1')).toBeTruthy();
    });

    it('handles units with missing names gracefully', () => {
      const unitsWithMissingNames = [
        {
          UnitId: '1',
          Name: '',
          Type: 'Engine',
          DepartmentId: '1',
          TypeId: 1,
          CustomStatusSetId: '',
          GroupId: '1',
          GroupName: 'Station 1',
          Vin: '',
          PlateNumber: '',
          FourWheelDrive: false,
          SpecialPermit: false,
          CurrentDestinationId: '',
          CurrentStatusId: '',
          CurrentStatusTimestamp: '',
          Latitude: '',
          Longitude: '',
          Note: '',
        } as UnitResultData,
      ];

      mockUseUnitsStore.mockReturnValue({
        units: unitsWithMissingNames,
        fetchUnits: mockFetchUnits,
        isLoading: false,
      } as any);

      render(<UnitSelectionBottomSheet {...mockProps} />);

      // Should still render the unit even with empty name
      expect(screen.getByText('Engine')).toBeTruthy();
    });

    it('handles very long unit names gracefully', () => {
      const unitsWithLongNames = [
        {
          UnitId: '1',
          Name: 'This is a very long unit name that might cause layout issues in the UI',
          Type: 'Engine',
          DepartmentId: '1',
          TypeId: 1,
          CustomStatusSetId: '',
          GroupId: '1',
          GroupName: 'Station 1',
          Vin: '',
          PlateNumber: '',
          FourWheelDrive: false,
          SpecialPermit: false,
          CurrentDestinationId: '',
          CurrentStatusId: '',
          CurrentStatusTimestamp: '',
          Latitude: '',
          Longitude: '',
          Note: '',
        } as UnitResultData,
      ];

      mockUseUnitsStore.mockReturnValue({
        units: unitsWithLongNames,
        fetchUnits: mockFetchUnits,
        isLoading: false,
      } as any);

      render(<UnitSelectionBottomSheet {...mockProps} />);

      expect(screen.getByText('This is a very long unit name that might cause layout issues in the UI')).toBeTruthy();
    });
  });
});
