import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { View, Text, TouchableOpacity } from 'react-native';

import Login from '../index';

const mockPush = jest.fn();

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock expo-linking (used for SAML deep-link handling)
jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  parse: jest.fn(() => ({ queryParams: {} })),
}));

// Mock SSO discovery service
jest.mock('@/services/sso-discovery', () => ({
  fetchSsoConfigForUser: jest.fn(() => Promise.resolve({ config: null, userExists: false })),
}));

// Mock OIDC hook
jest.mock('@/hooks/use-oidc-login', () => ({
  useOidcLogin: jest.fn(() => ({
    request: null,
    response: null,
    promptAsync: jest.fn(),
    exchangeForResgridToken: jest.fn(),
    discovery: null,
  })),
}));

// Mock SAML hook
jest.mock('@/hooks/use-saml-login', () => ({
  useSamlLogin: jest.fn(() => ({
    startSamlLogin: jest.fn(),
    handleDeepLink: jest.fn(),
    isSamlCallback: jest.fn(() => false),
  })),
}));

// Mock UI components
jest.mock('@/components/ui', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    FocusAwareStatusBar: () => React.createElement(View, { testID: 'focus-aware-status-bar' }),
  };
});

jest.mock('@/components/ui/modal', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Modal: ({ children, isOpen }: any) => (isOpen ? React.createElement(View, { testID: 'modal' }, children) : null),
    ModalBackdrop: ({ children }: any) => React.createElement(View, { testID: 'modal-backdrop' }, children),
    ModalContent: ({ children, className }: any) => React.createElement(View, { testID: 'modal-content', className }, children),
    ModalHeader: ({ children }: any) => React.createElement(View, { testID: 'modal-header' }, children),
    ModalBody: ({ children }: any) => React.createElement(View, { testID: 'modal-body' }, children),
    ModalFooter: ({ children }: any) => React.createElement(View, { testID: 'modal-footer' }, children),
  };
});

jest.mock('@/components/ui/text', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Text: ({ children, className, testID }: any) => React.createElement(Text, { className, testID }, children),
  };
});

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');

  return {
    Button: ({ children, onPress, variant, size, action }: any) =>
      React.createElement(TouchableOpacity, { onPress, testID: 'button' }, children),
    ButtonText: ({ children }: any) => React.createElement(Text, {}, children),
  };
});

jest.mock('@/components/settings/server-url-bottom-sheet', () => {
  const React = require('react');
  const { View, TouchableOpacity } = require('react-native');

  return {
    ServerUrlBottomSheet: ({ isOpen, onClose }: any) =>
      isOpen ? React.createElement(View, { testID: 'server-url-bottom-sheet' },
        React.createElement(TouchableOpacity, { onPress: onClose, testID: 'close-server-url' }, 'Close')
      ) : null,
  };
});

jest.mock('../login-form', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');

  return {
    LoginForm: ({ onSubmit, isLoading, error, onServerUrlPress }: any) =>
      React.createElement(View, { testID: 'login-form' }, [
        React.createElement(Text, { key: 'loading' }, isLoading ? 'Loading...' : 'Not Loading'),
        error && React.createElement(Text, { key: 'error' }, error),
        React.createElement(TouchableOpacity, {
          key: 'submit',
          onPress: () => onSubmit({ username: 'test', password: 'test' }),
          testID: 'submit-login'
        }, 'Submit'),
        onServerUrlPress && React.createElement(TouchableOpacity, {
          key: 'server-url',
          onPress: onServerUrlPress,
          testID: 'server-url-button'
        }, 'Server URL'),
      ])
  };
});

// Mock hooks
const mockUseAuth = jest.fn();
const mockUseAnalytics = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'login.errorModal.title': 'Error',
        'login.errorModal.message': 'Login failed',
        'login.errorModal.confirmButton': 'OK',
        'login.server.us_west': 'US West',
        'login.errors.invalid_credentials.title': 'Incorrect username or password',
        'login.errors.invalid_credentials.message': 'Check your username and password.',
        'login.errors.account_locked_out.title': 'Account temporarily locked',
        'login.errors.account_locked_out.message': 'Wait {{minutes}} min and try again.',
        'login.errors.account_locked.title': 'Account locked',
        'login.errors.account_locked.message': 'Contact your department administrator.',
        'login.errors.server_unreachable.title': "Can't reach the server",
        'login.errors.server_unreachable.message': "Couldn't connect to {{server}}.",
      };
      const text = translations[key] || key;
      return options ? text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? '')) : text;
    },
  }),
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => mockUseAnalytics(),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// The second-factor sheet renders as a marker that says whether it is open.
jest.mock('@/components/auth/login-mfa-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LoginMfaSheet: ({ isOpen }: { isOpen: boolean }) => (isOpen ? React.createElement(View, { testID: 'login-mfa-sheet-open' }) : null) };
});

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default mock return values
    mockUseAuth.mockReturnValue({
      login: jest.fn(),
      ssoLogin: jest.fn(),
      status: 'idle',
      error: null,
      isAuthenticated: false,
    });

    mockUseAnalytics.mockReturnValue({
      trackEvent: jest.fn(),
    });
  });

  it('renders login form and server URL button', () => {
    render(<Login />);

    expect(screen.getByTestId('login-form')).toBeTruthy();
    expect(screen.getByTestId('server-url-button')).toBeTruthy();
  });

  it('opens server URL bottom sheet when server URL button is pressed', async () => {
    render(<Login />);

    const serverUrlButton = screen.getByTestId('server-url-button');
    fireEvent.press(serverUrlButton);

    await waitFor(() => {
      expect(screen.getByTestId('server-url-bottom-sheet')).toBeTruthy();
    });
  });

  it('closes server URL bottom sheet when close is pressed', async () => {
    render(<Login />);

    // Open the bottom sheet
    const serverUrlButton = screen.getByTestId('server-url-button');
    fireEvent.press(serverUrlButton);

    await waitFor(() => {
      expect(screen.getByTestId('server-url-bottom-sheet')).toBeTruthy();
    });

    // Close the bottom sheet
    const closeButton = screen.getByTestId('close-server-url');
    fireEvent.press(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('server-url-bottom-sheet')).toBeNull();
    });
  });

  it('shows error modal when status is error', () => {
    mockUseAuth.mockReturnValue({
      login: jest.fn(),
      ssoLogin: jest.fn(),
      status: 'error',
      error: 'Invalid credentials',
      isAuthenticated: false,
    });

    render(<Login />);

    expect(screen.getByTestId('modal')).toBeTruthy();
    expect(screen.getByText('Login failed')).toBeTruthy();
  });

  it('redirects to app when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      login: jest.fn(),
      ssoLogin: jest.fn(),
      status: 'signedIn',
      error: null,
      isAuthenticated: true,
    });

    render(<Login />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(app)');
    });
  });

  it('tracks analytics when login view is rendered', () => {
    const mockTrackEvent = jest.fn();
    mockUseAnalytics.mockReturnValue({
      trackEvent: mockTrackEvent,
    });

    render(<Login />);

    expect(mockTrackEvent).toHaveBeenCalledWith('login_view_rendered', {
      hasError: false,
      status: 'idle',
    });
  });

  it('calls login function when form is submitted', () => {
    const mockLogin = jest.fn();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      ssoLogin: jest.fn(),
      status: 'idle',
      error: null,
      isAuthenticated: false,
    });

    render(<Login />);

    const submitButton = screen.getByTestId('submit-login');
    fireEvent.press(submitButton);

    expect(mockLogin).toHaveBeenCalledWith({ username: 'test', password: 'test' });
  });
});

describe('a refused password sign-in on the login screen', () => {
  const { default: useAuthStore } = jest.requireActual('@/stores/auth/store') as typeof import('@/stores/auth/store');
  const { useServerUrlStore } = jest.requireActual('@/stores/app/server-url-store') as typeof import('@/stores/app/server-url-store');
  const refusedWith = (error: string) => mockUseAuth.mockReturnValue({ login: jest.fn(), ssoLogin: jest.fn(), status: 'error', error, isAuthenticated: false });

  beforeEach(() => {
    mockUseAnalytics.mockReturnValue({ trackEvent: jest.fn() });
    useServerUrlStore.setState({ url: 'https://api.resgrid.com/api/v4' });
  });
  afterEach(() => {
    useAuthStore.setState({ loginFailure: null });
    useServerUrlStore.setState({ url: '' });
  });

  it('says why it failed and what to do, in place of the raw code', () => {
    refusedWith('invalid_credentials');
    useAuthStore.setState({ loginFailure: { code: 'invalid_credentials' } });
    render(<Login />);

    expect(screen.getByText('Incorrect username or password')).toBeTruthy();
    expect(screen.getByTestId('login-error-message')).toHaveTextContent('Check your username and password.');
    // The form's banner shows the same guidance; the code itself never reaches the screen.
    expect(screen.getAllByText('Check your username and password.')).toHaveLength(2);
    expect(screen.queryByText('invalid_credentials')).toBeNull();
    expect(screen.queryByText('Login failed')).toBeNull();
  });

  it('tells a temporarily locked account how long to wait', () => {
    refusedWith('account_locked_out');
    useAuthStore.setState({ loginFailure: { code: 'account_locked_out', lockoutMinutes: 12 } });
    render(<Login />);

    expect(screen.getByText('Account temporarily locked')).toBeTruthy();
    expect(screen.getByTestId('login-error-message')).toHaveTextContent('Wait 12 min and try again.');
  });

  it('sends a lockout with no end to the administrator', () => {
    refusedWith('account_locked_out');
    render(<Login />);

    expect(screen.getByText('Account locked')).toBeTruthy();
    expect(screen.getByTestId('login-error-message')).toHaveTextContent('Contact your department administrator.');
  });

  it('names the server it could not reach', () => {
    refusedWith('server_unreachable');
    useAuthStore.setState({ loginFailure: { code: 'server_unreachable' } });
    render(<Login />);

    expect(screen.getByTestId('login-error-message')).toHaveTextContent("Couldn't connect to US West.");
  });
});

describe('the second-factor sheet on the login screen', () => {
  const { default: useAuthStore } = jest.requireActual('@/stores/auth/store') as typeof import('@/stores/auth/store');
  const verify = (source: 'password' | 'sso') => ({ kind: 'verify' as const, methods: ['totp' as const], enrolled: ['totp' as const], preferred: 'totp' as const, expiresAt: null, source });

  beforeEach(() => {
    mockUseAuth.mockReturnValue({ login: jest.fn(), ssoLogin: jest.fn(), status: 'mfaRequired', error: null, isAuthenticated: false });
    mockUseAnalytics.mockReturnValue({ trackEvent: jest.fn() });
  });
  afterEach(() => useAuthStore.setState({ mfaChallenge: null }));

  it('opens for a password sign-in that continues on a login transaction', () => {
    useAuthStore.setState({ mfaChallenge: verify('password') });
    render(<Login />);
    expect(screen.getByTestId('login-mfa-sheet-open')).toBeTruthy();
  });

  it("leaves a single sign-on's second factor to the SSO screen on top of it", () => {
    // Both screens are mounted while the SSO screen is shown; two sheets would each stage their own setup key.
    useAuthStore.setState({ mfaChallenge: verify('sso') });
    render(<Login />);
    expect(screen.queryByTestId('login-mfa-sheet-open')).toBeNull();
  });
});
