/**
 * Tests for AptabaseProviderWrapper component
 * 
 * This test suite verifies that the Aptabase provider wrapper:
 * - Renders children correctly
 * - Handles service configuration gracefully
 * - Doesn't crash during initialization
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

// Mock Aptabase init function
jest.mock('@aptabase/react-native', () => ({
  init: jest.fn(),
}));

// Mock the environment variables
jest.mock('@env', () => ({
  Env: {
    APTABASE_APP_KEY: 'mock-env-app-key',
    APTABASE_URL: 'https://mock-aptabase-url.com',
  },
}));

// Mock the logger
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the Aptabase service completely
jest.mock('@/services/aptabase.service', () => ({
  aptabaseService: {
    isAnalyticsDisabled: jest.fn().mockReturnValue(false),
    reset: jest.fn(),
    getStatus: jest.fn().mockReturnValue({
      retryCount: 0,
      isDisabled: false,
      maxRetries: 2,
      disableTimeoutMinutes: 10,
    }),
  },
}));

// Import component after mocks are set up
import { AptabaseProviderWrapper } from '../aptabase-provider';

describe('AptabaseProviderWrapper', () => {
  const mockProps = {
    appKey: 'test-app-key',
    children: <Text>Test Child</Text>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service mock to default state
    const { aptabaseService } = require('@/services/aptabase.service');
    aptabaseService.isAnalyticsDisabled.mockReturnValue(false);
  });

  it('renders children correctly', () => {
    const { getByText } = render(<AptabaseProviderWrapper {...mockProps} />);
    expect(getByText('Test Child')).toBeTruthy();
  });

  it('renders with different configuration', () => {
    const propsWithDifferentConfig = {
      appKey: 'different-app-key',
      children: <Text>Test Child</Text>,
    };

    const { getByText } = render(<AptabaseProviderWrapper {...propsWithDifferentConfig} />);
    expect(getByText('Test Child')).toBeTruthy();
  });

  it('handles component unmounting', () => {
    const { getByText, unmount } = render(<AptabaseProviderWrapper {...mockProps} />);

    expect(getByText('Test Child')).toBeTruthy();

    // Should not throw when unmounting
    expect(() => unmount()).not.toThrow();
  });

  it('initializes Aptabase on mount', () => {
    const { init } = require('@aptabase/react-native');

    render(<AptabaseProviderWrapper {...mockProps} />);

    expect(init).toHaveBeenCalledWith('test-app-key', {
      host: 'https://mock-aptabase-url.com',
    });
  });

  it('handles initialization errors gracefully', () => {
    const { init } = require('@aptabase/react-native');
    const { aptabaseService } = require('@/services/aptabase.service');

    init.mockImplementation(() => {
      throw new Error('Initialization failed');
    });

    const { getByText } = render(<AptabaseProviderWrapper {...mockProps} />);

    // Should still render children even if initialization fails
    expect(getByText('Test Child')).toBeTruthy();
    expect(aptabaseService.reset).toHaveBeenCalled();
  });

  it('skips initialization when service is disabled', () => {
    const { init } = require('@aptabase/react-native');
    const { aptabaseService } = require('@/services/aptabase.service');

    aptabaseService.isAnalyticsDisabled.mockReturnValue(true);

    render(<AptabaseProviderWrapper {...mockProps} />);

    expect(init).not.toHaveBeenCalled();
  });
});
