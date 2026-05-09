import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react-native';
import { Text as RNText, View } from 'react-native';

import { CustomBottomSheet } from '../bottom-sheet';

// Mock nativewind
jest.mock('nativewind', () => ({
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

// Mock UI components used by the bottom-sheet component
jest.mock('../center', () => ({
  Center: ({ children, className, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="center" className={className} {...props}>{children}</View>;
  },
}));

jest.mock('../spinner', () => ({
  Spinner: ({ size, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="spinner" size={size} {...props} />;
  },
}));

jest.mock('../text', () => ({
  Text: ({ children, className, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText testID="text" className={className} {...props}>{children}</RNText>;
  },
}));

jest.mock('../vstack', () => ({
  VStack: ({ children, className, space, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="vstack" className={className} space={space} {...props}>{children}</View>;
  },
}));

const { useColorScheme } = require('nativewind');

// Mock console.error to prevent logging issues in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('CustomBottomSheet', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <RNText>Test Content</RNText>,
    testID: 'bottom-sheet',
  };

  describe('Basic Rendering', () => {
    it('should render successfully when open', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
      expect(screen.getByTestId('bottom-sheet-backdrop')).toBeTruthy();
      expect(screen.getByTestId('bottom-sheet-content')).toBeTruthy();
      expect(screen.getAllByTestId('vstack').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Test Content')).toBeTruthy();
    });

    it('should not render when closed', () => {
      render(<CustomBottomSheet {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
      expect(screen.queryByText('Test Content')).toBeNull();
    });

    it('should render with custom testID', () => {
      render(<CustomBottomSheet {...defaultProps} testID="custom-bottom-sheet" />);

      expect(screen.getByTestId('custom-bottom-sheet')).toBeTruthy();
    });
  });

  describe('Props Handling', () => {
    it('should pass snapPoints correctly', () => {
      const snapPoints = [25, 50, 75];
      render(<CustomBottomSheet {...defaultProps} snapPoints={snapPoints} />);

      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('should use default snapPoints when not provided', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('should apply custom minHeight', () => {
      render(<CustomBottomSheet {...defaultProps} minHeight="min-h-[600px]" />);

      const vstacks = screen.getAllByTestId('vstack');
      expect(vstacks.length).toBeGreaterThanOrEqual(1);
    });

    it('should use default minHeight when not provided', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const vstacks = screen.getAllByTestId('vstack');
      expect(vstacks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle onClose callback', () => {
      const onCloseMock = jest.fn();
      render(<CustomBottomSheet {...defaultProps} onClose={onCloseMock} />);

      // Advance timers to enable the backdrop
      act(() => {
        jest.advanceTimersByTime(300);
      });

      const backdrop = screen.getByTestId('bottom-sheet-backdrop');
      fireEvent.press(backdrop);

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      // Center appears in drag indicator + loading spinner
      expect(screen.getAllByTestId('center').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('Test Content')).toBeNull();
    });

    it('should show loading text when provided', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} loadingText="Loading data..." />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.getByText('Loading data...')).toBeTruthy();
    });

    it('should not show loading text when not provided', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.queryByTestId('text')).toBeNull();
    });

    it('should show children when not loading', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={false} />);

      expect(screen.queryByTestId('spinner')).toBeNull();
      // When not loading, only the drag indicator Center exists
      expect(screen.getAllByTestId('center').length).toBe(1);
      expect(screen.getByText('Test Content')).toBeTruthy();
    });

    it('should default to not loading when isLoading is not provided', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(screen.getByText('Test Content')).toBeTruthy();
    });
  });

  describe('Color Scheme', () => {
    it('should apply light theme styles', () => {
      useColorScheme.mockReturnValue({ colorScheme: 'light' });

      render(<CustomBottomSheet {...defaultProps} />);

      const content = screen.getByTestId('bottom-sheet-content');
      expect(content.props.style.backgroundColor).toBe('#ffffff');
    });

    it('should apply dark theme styles', () => {
      useColorScheme.mockReturnValue({ colorScheme: 'dark' });

      render(<CustomBottomSheet {...defaultProps} />);

      const content = screen.getByTestId('bottom-sheet-content');
      expect(content.props.style.backgroundColor).toBe('#171717');
    });

    it('should handle color scheme changes', () => {
      useColorScheme.mockReturnValue({ colorScheme: 'light' });

      const { rerender } = render(<CustomBottomSheet {...defaultProps} />);

      let content = screen.getByTestId('bottom-sheet-content');
      expect(content.props.style.backgroundColor).toBe('#ffffff');

      useColorScheme.mockReturnValue({ colorScheme: 'dark' });
      rerender(<CustomBottomSheet {...defaultProps} />);

      content = screen.getByTestId('bottom-sheet-content');
      expect(content.props.style.backgroundColor).toBe('#171717');
    });
  });

  describe('Children Rendering', () => {
    it('should render simple text children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          <RNText>Simple Text</RNText>
        </CustomBottomSheet>
      );

      expect(screen.getByText('Simple Text')).toBeTruthy();
    });

    it('should render complex children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          <View>
            <RNText>Title</RNText>
            <RNText>Description</RNText>
          </View>
        </CustomBottomSheet>
      );

      expect(screen.getByText('Title')).toBeTruthy();
      expect(screen.getByText('Description')).toBeTruthy();
    });

    it('should render multiple children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          <RNText>Child 1</RNText>
          <RNText>Child 2</RNText>
          <RNText>Child 3</RNText>
        </CustomBottomSheet>
      );

      expect(screen.getByText('Child 1')).toBeTruthy();
      expect(screen.getByText('Child 2')).toBeTruthy();
      expect(screen.getByText('Child 3')).toBeTruthy();
    });

    it('should handle null children', () => {
      render(<CustomBottomSheet {...defaultProps}>{null}</CustomBottomSheet>);

      expect(screen.getAllByTestId('vstack').length).toBeGreaterThanOrEqual(1);
    });

    it('should handle undefined children', () => {
      render(<CustomBottomSheet {...defaultProps}>{undefined}</CustomBottomSheet>);

      expect(screen.getAllByTestId('vstack').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct content styles', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const content = screen.getByTestId('bottom-sheet-content');
      expect(content.props.style.borderTopLeftRadius).toBe(24);
      expect(content.props.style.borderTopRightRadius).toBe(24);
      expect(content.props.style.paddingHorizontal).toBe(16);
      expect(content.props.style.paddingBottom).toBe(24);
    });

    it('should apply correct VStack classes', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const vstacks = screen.getAllByTestId('vstack');
      // Content wrapper VStack (second one) should have w-full and space="md"
      const contentVstack = vstacks[1];
      expect(contentVstack.props.className).toContain('w-full');
      expect(contentVstack.props.space).toBe('md');
    });

    it('should apply correct loading Center classes', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      const centers = screen.getAllByTestId('center');
      // Loading Center (second one) should have h-32
      const loadingCenter = centers[1];
      expect(loadingCenter.props.className).toContain('h-32');
    });

    it('should apply correct loading text classes', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} loadingText="Loading..." />);

      const text = screen.getByTestId('text');
      expect(text.props.className).toContain('text-sm');
      expect(text.props.className).toContain('text-gray-500');
    });
  });

  describe('State Management', () => {
    it('should handle isOpen state changes', () => {
      const { rerender } = render(<CustomBottomSheet {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('bottom-sheet')).toBeNull();

      rerender(<CustomBottomSheet {...defaultProps} isOpen={true} />);

      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('should handle isLoading state changes', () => {
      const { rerender } = render(<CustomBottomSheet {...defaultProps} isLoading={false} />);

      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(screen.getByText('Test Content')).toBeTruthy();

      rerender(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.queryByText('Test Content')).toBeNull();
    });

    it('should handle loadingText changes', () => {
      const { rerender } = render(
        <CustomBottomSheet {...defaultProps} isLoading={true} loadingText="Loading..." />
      );

      expect(screen.getByText('Loading...')).toBeTruthy();

      rerender(<CustomBottomSheet {...defaultProps} isLoading={true} loadingText="Please wait..." />);

      expect(screen.getByText('Please wait...')).toBeTruthy();
      expect(screen.queryByText('Loading...')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty snapPoints array', () => {
      render(<CustomBottomSheet {...defaultProps} snapPoints={[]} />);

      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('should handle single snapPoint', () => {
      render(<CustomBottomSheet {...defaultProps} snapPoints={[100]} />);

      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('should handle empty string minHeight', () => {
      render(<CustomBottomSheet {...defaultProps} minHeight="" />);

      const vstacks = screen.getAllByTestId('vstack');
      expect(vstacks.some((v) => v.props.className?.includes('w-full'))).toBe(true);
    });

    it('should handle empty string loadingText', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} loadingText="" />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.queryByTestId('text')).toBeNull();
    });

    it('should handle multiple onClose calls', () => {
      const onCloseMock = jest.fn();
      render(<CustomBottomSheet {...defaultProps} onClose={onCloseMock} />);

      // Advance timers to enable the backdrop
      act(() => {
        jest.advanceTimersByTime(300);
      });

      const backdrop = screen.getByTestId('bottom-sheet-backdrop');
      fireEvent.press(backdrop);
      fireEvent.press(backdrop);
      fireEvent.press(backdrop);

      expect(onCloseMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('Component Structure', () => {
    it('should maintain correct component hierarchy', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const modal = screen.getByTestId('bottom-sheet');
      const backdrop = screen.getByTestId('bottom-sheet-backdrop');
      const content = screen.getByTestId('bottom-sheet-content');
      const vstacks = screen.getAllByTestId('vstack');
      const centers = screen.getAllByTestId('center');

      expect(modal).toBeTruthy();
      expect(backdrop).toBeTruthy();
      expect(content).toBeTruthy();
      // At least 1 VStack (drag indicator) and 1 Center (drag indicator bar)
      expect(vstacks.length).toBeGreaterThanOrEqual(1);
      expect(centers.length).toBeGreaterThanOrEqual(1);
    });

    it('should have correct loading state structure', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} loadingText="Loading..." />);

      const centers = screen.getAllByTestId('center');
      const spinner = screen.getByTestId('spinner');
      const text = screen.getByTestId('text');

      // 2 Centers: drag indicator + loading
      expect(centers.length).toBe(2);
      expect(spinner).toBeTruthy();
      expect(text).toBeTruthy();
    });
  });
});
