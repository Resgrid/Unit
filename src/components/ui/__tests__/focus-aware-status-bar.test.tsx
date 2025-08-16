import { useIsFocused } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Platform, StatusBar } from 'react-native';
import { render } from '@testing-library/react-native';
import { SystemBars } from 'react-native-edge-to-edge';

import { FocusAwareStatusBar } from '../focus-aware-status-bar';

// Mock dependencies
jest.mock('@react-navigation/native');
jest.mock('expo-navigation-bar');
jest.mock('nativewind');
jest.mock('react-native-edge-to-edge');

const mockUseIsFocused = useIsFocused as jest.MockedFunction<typeof useIsFocused>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockSystemBars = SystemBars as jest.MockedFunction<typeof SystemBars>;
const mockNavigationBar = NavigationBar as jest.Mocked<typeof NavigationBar>;

// Mock StatusBar methods
const mockStatusBar = {
  setBackgroundColor: jest.fn(),
  setTranslucent: jest.fn(),
  setHidden: jest.fn(),
  setBarStyle: jest.fn(),
};

// Replace StatusBar with our mock
Object.defineProperty(StatusBar, 'setBackgroundColor', {
  value: mockStatusBar.setBackgroundColor,
  writable: true,
});
Object.defineProperty(StatusBar, 'setTranslucent', {
  value: mockStatusBar.setTranslucent,
  writable: true,
});
Object.defineProperty(StatusBar, 'setHidden', {
  value: mockStatusBar.setHidden,
  writable: true,
});
Object.defineProperty(StatusBar, 'setBarStyle', {
  value: mockStatusBar.setBarStyle,
  writable: true,
});

describe('FocusAwareStatusBar', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsFocused.mockReturnValue(true);
    mockUseColorScheme.mockReturnValue({ colorScheme: 'light' } as any);
    mockNavigationBar.setVisibilityAsync.mockResolvedValue();
    mockSystemBars.mockReturnValue(null);
  });

  afterEach(() => {
    // Reset Platform.OS to original value
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('Platform: Android', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('should configure status bar and navigation bar on Android when not hidden', () => {
      render(<FocusAwareStatusBar hidden={false} />);

      expect(mockStatusBar.setBackgroundColor).toHaveBeenCalledWith('transparent');
      expect(mockStatusBar.setTranslucent).toHaveBeenCalledWith(true);
      expect(mockNavigationBar.setVisibilityAsync).toHaveBeenCalledWith('hidden');
      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(false, 'slide');
      expect(mockStatusBar.setBarStyle).toHaveBeenCalledWith('dark-content');
    });

    it('should hide status bar when hidden=true on Android', () => {
      render(<FocusAwareStatusBar hidden={true} />);

      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(true, 'slide');
      expect(mockStatusBar.setBarStyle).toHaveBeenCalledWith('dark-content');
    });

    it('should use light content for dark color scheme on Android', () => {
      mockUseColorScheme.mockReturnValue({ colorScheme: 'dark' } as any);

      render(<FocusAwareStatusBar />);

      expect(mockStatusBar.setBarStyle).toHaveBeenCalledWith('light-content');
    });

    it('should handle NavigationBar.setVisibilityAsync errors gracefully on Android', async () => {
      mockNavigationBar.setVisibilityAsync.mockRejectedValue(new Error('Navigation bar not available'));

      // Should not throw an error
      expect(() => render(<FocusAwareStatusBar />)).not.toThrow();
    });

    it('should render SystemBars when focused on Android', () => {
      mockUseIsFocused.mockReturnValue(true);

      render(<FocusAwareStatusBar hidden={false} />);

      expect(mockSystemBars).toHaveBeenCalledWith(
        {
          style: 'light',
          hidden: { statusBar: false, navigationBar: true },
        },
        {}
      );
    });

    it('should not render SystemBars when not focused on Android', () => {
      mockUseIsFocused.mockReturnValue(false);

      render(<FocusAwareStatusBar />);

      expect(mockSystemBars).not.toHaveBeenCalled();
    });
  });

  describe('Platform: iOS', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });
    });

    it('should configure status bar on iOS when not hidden', () => {
      render(<FocusAwareStatusBar hidden={false} />);

      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(false, 'slide');
      expect(mockStatusBar.setBarStyle).toHaveBeenCalledWith('dark-content');

      // Android-specific methods should not be called
      expect(mockStatusBar.setBackgroundColor).not.toHaveBeenCalled();
      expect(mockStatusBar.setTranslucent).not.toHaveBeenCalled();
      expect(mockNavigationBar.setVisibilityAsync).not.toHaveBeenCalled();
    });

    it('should hide status bar when hidden=true on iOS', () => {
      render(<FocusAwareStatusBar hidden={true} />);

      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(true, 'slide');
      expect(mockStatusBar.setBarStyle).toHaveBeenCalledWith('dark-content');
    });

    it('should use light content for dark color scheme on iOS', () => {
      mockUseColorScheme.mockReturnValue({ colorScheme: 'dark' } as any);

      render(<FocusAwareStatusBar />);

      expect(mockStatusBar.setBarStyle).toHaveBeenCalledWith('light-content');
    });

    it('should render SystemBars when focused on iOS', () => {
      mockUseIsFocused.mockReturnValue(true);

      render(<FocusAwareStatusBar hidden={false} />);

      expect(mockSystemBars).toHaveBeenCalledWith(
        {
          style: 'light',
          hidden: { statusBar: false, navigationBar: true },
        },
        {}
      );
    });

    it('should not render SystemBars when not focused on iOS', () => {
      mockUseIsFocused.mockReturnValue(false);

      render(<FocusAwareStatusBar />);

      expect(mockSystemBars).not.toHaveBeenCalled();
    });
  });

  describe('Platform: Web', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        writable: true,
      });
    });

    it('should return null on web platform', () => {
      render(<FocusAwareStatusBar />);

      expect(mockSystemBars).not.toHaveBeenCalled();

      // Status bar methods should not be called on web
      expect(mockStatusBar.setBackgroundColor).not.toHaveBeenCalled();
      expect(mockStatusBar.setTranslucent).not.toHaveBeenCalled();
      expect(mockStatusBar.setHidden).not.toHaveBeenCalled();
      expect(mockStatusBar.setBarStyle).not.toHaveBeenCalled();
      expect(mockNavigationBar.setVisibilityAsync).not.toHaveBeenCalled();
    });
  });

  describe('Platform: Unknown', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'unknown' as any,
        writable: true,
      });
    });

    it('should not call platform-specific methods on unknown platform', () => {
      render(<FocusAwareStatusBar />);

      expect(mockStatusBar.setBackgroundColor).not.toHaveBeenCalled();
      expect(mockStatusBar.setTranslucent).not.toHaveBeenCalled();
      expect(mockStatusBar.setHidden).not.toHaveBeenCalled();
      expect(mockStatusBar.setBarStyle).not.toHaveBeenCalled();
      expect(mockNavigationBar.setVisibilityAsync).not.toHaveBeenCalled();
    });

    it('should not render SystemBars on unknown platform', () => {
      render(<FocusAwareStatusBar />);

      expect(mockSystemBars).not.toHaveBeenCalled();
    });
  });

  describe('Props handling', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('should use default hidden=false when prop is not provided', () => {
      render(<FocusAwareStatusBar />);

      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(false, 'slide');
    });

    it('should handle hidden=true prop', () => {
      render(<FocusAwareStatusBar hidden={true} />);

      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(true, 'slide');
    });

    it('should handle hidden=false prop explicitly', () => {
      render(<FocusAwareStatusBar hidden={false} />);

      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(false, 'slide');
    });
  });

  describe('Color scheme changes', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('should update status bar style when color scheme changes', () => {
      const { rerender } = render(<FocusAwareStatusBar />);

      expect(mockStatusBar.setBarStyle).toHaveBeenLastCalledWith('dark-content');

      // Change color scheme to dark
      mockUseColorScheme.mockReturnValue({ colorScheme: 'dark' } as any);
      rerender(<FocusAwareStatusBar />);

      expect(mockStatusBar.setBarStyle).toHaveBeenLastCalledWith('light-content');
    });

    it('should pass correct style to SystemBars based on color scheme', () => {
      mockUseColorScheme.mockReturnValue({ colorScheme: 'dark' } as any);

      render(<FocusAwareStatusBar />);

      expect(mockSystemBars).toHaveBeenCalledWith(
        {
          style: 'dark',
          hidden: { statusBar: false, navigationBar: true },
        },
        {}
      );
    });
  });

  describe('Focus state changes', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('should update rendering when focus state changes', () => {
      mockUseIsFocused.mockReturnValue(false);
      const { rerender } = render(<FocusAwareStatusBar />);

      expect(mockSystemBars).not.toHaveBeenCalled();

      // Change to focused
      mockUseIsFocused.mockReturnValue(true);
      rerender(<FocusAwareStatusBar />);

      expect(mockSystemBars).toHaveBeenCalled();
    });
  });

  describe('Effect dependencies', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('should call useEffect when hidden prop changes', () => {
      const { rerender } = render(<FocusAwareStatusBar hidden={false} />);

      expect(mockStatusBar.setHidden).toHaveBeenLastCalledWith(false, 'slide');
      jest.clearAllMocks();

      rerender(<FocusAwareStatusBar hidden={true} />);

      expect(mockStatusBar.setHidden).toHaveBeenLastCalledWith(true, 'slide');
    });

    it('should call useEffect when colorScheme changes', () => {
      const { rerender } = render(<FocusAwareStatusBar />);

      expect(mockStatusBar.setBarStyle).toHaveBeenLastCalledWith('dark-content');
      jest.clearAllMocks();

      mockUseColorScheme.mockReturnValue({ colorScheme: 'dark' } as any);
      rerender(<FocusAwareStatusBar />);

      expect(mockStatusBar.setBarStyle).toHaveBeenLastCalledWith('light-content');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
      // Reset all mocks to their original implementations
      mockStatusBar.setBackgroundColor.mockImplementation(() => { });
      mockStatusBar.setTranslucent.mockImplementation(() => { });
      mockStatusBar.setHidden.mockImplementation(() => { });
      mockStatusBar.setBarStyle.mockImplementation(() => { });
      mockNavigationBar.setVisibilityAsync.mockResolvedValue();
    });

    it('should handle StatusBar method errors gracefully', () => {
      mockStatusBar.setBackgroundColor.mockImplementation(() => {
        throw new Error('StatusBar not available');
      });

      // Should not throw an error
      expect(() => render(<FocusAwareStatusBar />)).not.toThrow();
    });

    it('should handle NavigationBar method errors gracefully', async () => {
      mockNavigationBar.setVisibilityAsync.mockRejectedValue(new Error('NavigationBar not available'));

      // Should not throw an error
      expect(() => render(<FocusAwareStatusBar />)).not.toThrow();

      // Wait for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
      // Reset all mocks to their original implementations
      mockStatusBar.setBackgroundColor.mockImplementation(() => { });
      mockStatusBar.setTranslucent.mockImplementation(() => { });
      mockStatusBar.setHidden.mockImplementation(() => { });
      mockStatusBar.setBarStyle.mockImplementation(() => { });
      mockNavigationBar.setVisibilityAsync.mockResolvedValue();
    });

    it('should properly handle status bar visibility for accessibility', () => {
      render(<FocusAwareStatusBar hidden={false} />);

      // When not hidden, status bar should be visible for accessibility
      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(false, 'slide');
    });

    it('should handle hidden state for immersive experiences', () => {
      render(<FocusAwareStatusBar hidden={true} />);

      // When hidden, status bar should be hidden for immersive experiences
      expect(mockStatusBar.setHidden).toHaveBeenCalledWith(true, 'slide');
    });
  });
});
