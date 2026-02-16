import { render, screen } from '@testing-library/react-native';
import React from 'react';

// Mock nativewind useColorScheme — default to light mode
let mockColorScheme = 'light';
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
  cssInterop: jest.fn(),
}));

// Mock react-native-webview before importing HtmlRenderer
jest.mock('react-native-webview', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ source, ...rest }: { source: { html: string };[key: string]: any }) => (
      <View testID="native-webview" {...rest}>
        <Text testID="webview-html">{source.html}</Text>
      </View>
    ),
  };
});

import { HtmlRenderer } from '../index';

describe('HtmlRenderer (native)', () => {
  beforeEach(() => {
    mockColorScheme = 'light';
  });

  it('should render WebView with the provided HTML content', () => {
    render(<HtmlRenderer html="<p>Hello World</p>" />);

    const htmlContent = screen.getByTestId('webview-html');
    expect(htmlContent.props.children).toContain('<p>Hello World</p>');
    expect(htmlContent.props.children).toContain('<!DOCTYPE html>');
  });

  it('should apply custom textColor override', () => {
    render(<HtmlRenderer html="<p>Colored</p>" textColor="#FF0000" />);

    const htmlContent = screen.getByTestId('webview-html');
    expect(htmlContent.props.children).toContain('color: #FF0000');
  });

  it('should apply custom backgroundColor override', () => {
    render(<HtmlRenderer html="<p>BG</p>" backgroundColor="#333333" />);

    const htmlContent = screen.getByTestId('webview-html');
    expect(htmlContent.props.children).toContain('background-color: #333333');
  });

  describe('light mode defaults', () => {
    it('should use light theme text color when not specified', () => {
      render(<HtmlRenderer html="<p>Light</p>" />);

      const htmlContent = screen.getByTestId('webview-html');
      expect(htmlContent.props.children).toContain('color: #1F2937');
    });

    it('should use light theme background color when not specified', () => {
      render(<HtmlRenderer html="<p>Light BG</p>" />);

      const htmlContent = screen.getByTestId('webview-html');
      expect(htmlContent.props.children).toContain('background-color: transparent');
    });
  });

  describe('dark mode defaults', () => {
    beforeEach(() => {
      mockColorScheme = 'dark';
    });

    it('should use dark theme text color when not specified', () => {
      render(<HtmlRenderer html="<p>Dark</p>" />);

      const htmlContent = screen.getByTestId('webview-html');
      expect(htmlContent.props.children).toContain('color: #E5E7EB');
    });

    it('should use dark theme background color when not specified', () => {
      render(<HtmlRenderer html="<p>Dark BG</p>" />);

      const htmlContent = screen.getByTestId('webview-html');
      expect(htmlContent.props.children).toContain('background-color: transparent');
    });

    it('should allow overriding colors in dark mode', () => {
      render(<HtmlRenderer html="<p>Override</p>" textColor="#FFFFFF" backgroundColor="#000000" />);

      const htmlContent = screen.getByTestId('webview-html');
      expect(htmlContent.props.children).toContain('color: #FFFFFF');
      expect(htmlContent.props.children).toContain('background-color: #000000');
    });
  });

  it('should render the full HTML structure including viewport meta', () => {
    render(<HtmlRenderer html="<div>Test</div>" />);

    const htmlContent = screen.getByTestId('webview-html');
    expect(htmlContent.props.children).toContain('<meta name="viewport"');
    expect(htmlContent.props.children).toContain('<html>');
    expect(htmlContent.props.children).toContain('<body>');
    expect(htmlContent.props.children).toContain('<div>Test</div>');
  });

  it('should include responsive CSS styles', () => {
    render(<HtmlRenderer html="<p>Responsive</p>" />);

    const htmlContent = screen.getByTestId('webview-html');
    expect(htmlContent.props.children).toContain('max-width: 100%');
    expect(htmlContent.props.children).toContain('font-family: system-ui, -apple-system, sans-serif');
  });
});
