/**
 * Renders the REAL LoginForm.
 *
 * The previous suite did `jest.mock('../login-form')` and asserted against a hand-written
 * stand-in, so the app's authentication entry point had zero coverage. Only the form's
 * dependencies are mocked here (i18n, the language hook, the icon set and the keyboard
 * module); the react-hook-form + zod wiring under test is the real thing.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Image, Keyboard } from 'react-native';

// ── Dependency mocks (must precede the subject import) ───────────────────────

// The validation assertions below run the real zod schema through the real
// zodResolver. jest-setup.ts used to stub zod globally, which made that
// impossible; that stub has been removed, so no opt-out is needed here.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mirrors the global nativewind stub in jest-setup.ts (gluestack needs styled/cssInterop
// to stay pass-through) but lets the colour scheme be driven per test.
let mockColorScheme = 'light';
jest.mock('nativewind', () => ({
  __esModule: true,
  styled: jest.fn((Component: unknown) => Component),
  vars: jest.fn((v: unknown) => v),
  cssInterop: jest.fn((Component: unknown) => Component),
  useColorScheme: () => ({ colorScheme: mockColorScheme, get: () => mockColorScheme }),
}));

const mockSetLanguage = jest.fn();
jest.mock('@/lib', () => ({
  translate: (key: string) => key,
  useSelectedLanguage: () => ({ language: 'en', setLanguage: mockSetLanguage }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const makeIcon = (testID: string) => {
    const Icon = React.forwardRef((props: Record<string, unknown>, ref: unknown) => React.createElement(View, { testID, ...props, ref }));
    Icon.displayName = testID;
    return Icon;
  };
  return {
    AlertTriangle: makeIcon('alert-triangle-icon'),
    ChevronDownIcon: makeIcon('chevron-down-icon'),
    EyeIcon: makeIcon('eye-icon'),
    EyeOffIcon: makeIcon('eye-off-icon'),
    Globe: makeIcon('globe-icon'),
    ShieldCheck: makeIcon('shield-check-icon'),
  };
});

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';

import { LoginForm } from '../login-form';

const USERNAME_PLACEHOLDER = 'login.username_placeholder';
const PASSWORD_PLACEHOLDER = 'login.password_placeholder';
const SUBMIT_LABEL = 'login.login_button';
/** Accessible names for the icon-only reveal toggle (the i18n mock echoes the key). */
const SHOW_PASSWORD_LABEL = 'login.show_password';
const HIDE_PASSWORD_LABEL = 'login.hide_password';

/** Fills both fields and presses Sign In, then waits for the async resolver to settle. */
const submitWith = async (username: string, password: string) => {
  fireEvent.changeText(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), username);
  fireEvent.changeText(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), password);
  fireEvent.press(screen.getByLabelText(SUBMIT_LABEL));
};

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockColorScheme = 'light';
  });

  describe('rendering', () => {
    it('renders the heading, both credential fields and the submit control', () => {
      const { unmount } = render(<LoginForm />);

      expect(screen.getByText('login.title')).toBeTruthy();
      expect(screen.getByText('login.subtitle')).toBeTruthy();
      expect(screen.getByText('login.username')).toBeTruthy();
      expect(screen.getByText('login.password')).toBeTruthy();
      expect(screen.getByPlaceholderText(USERNAME_PLACEHOLDER)).toBeTruthy();
      expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeTruthy();
      expect(screen.getByLabelText(SUBMIT_LABEL)).toBeTruthy();

      unmount();
    });

    it('keeps credential fields free of autocapitalisation and autocomplete', () => {
      // Capitalising the first letter of a username is a classic "my password stopped
      // working" support ticket.
      const { unmount } = render(<LoginForm />);

      for (const placeholder of [USERNAME_PLACEHOLDER, PASSWORD_PLACEHOLDER]) {
        const field = screen.getByPlaceholderText(placeholder);
        expect(field.props.autoCapitalize).toBe('none');
        expect(field.props.autoComplete).toBe('off');
      }

      unmount();
    });

    it('swaps the wordmark for the light-on-dark asset in dark mode', () => {
      const { unmount } = render(<LoginForm />);
      const lightLogo = screen.UNSAFE_getByType(Image).props.source;
      unmount();

      mockColorScheme = 'dark';
      const dark = render(<LoginForm />);
      const darkLogo = screen.UNSAFE_getByType(Image).props.source;

      // A dark-mode login screen showing the dark wordmark is an invisible logo.
      expect(darkLogo).not.toEqual(lightLogo);

      dark.unmount();
    });

    it('masks the password field by default', () => {
      const { unmount } = render(<LoginForm />);

      expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER).props.secureTextEntry).toBe(true);
      expect(screen.getByPlaceholderText(USERNAME_PLACEHOLDER).props.secureTextEntry).toBeFalsy();

      unmount();
    });

    it('reveals and re-masks the password when the reveal toggle is pressed', () => {
      // Driven by accessible name rather than icon testID: that is how a screen-reader user
      // reaches this control, so the test fails if the label regresses.
      const { unmount } = render(<LoginForm />);

      expect(screen.getByTestId('eye-off-icon', { includeHiddenElements: true })).toBeTruthy();

      fireEvent.press(screen.getByLabelText(SHOW_PASSWORD_LABEL));

      expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER).props.secureTextEntry).toBe(false);
      expect(screen.getByTestId('eye-icon', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByTestId('eye-off-icon', { includeHiddenElements: true })).toBeNull();

      fireEvent.press(screen.getByLabelText(HIDE_PASSWORD_LABEL));

      expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER).props.secureTextEntry).toBe(true);

      unmount();
    });

    it('names the reveal toggle for assistive tech and flips the name with its state', () => {
      // An unlabelled icon-only toggle announces as a bare "button"; the name must also
      // describe what the press will do, not what the field currently is.
      const { unmount } = render(<LoginForm />);

      const toggle = screen.getByLabelText(SHOW_PASSWORD_LABEL);
      expect(toggle.props.accessibilityRole).toBe('button');
      expect(screen.queryByLabelText(HIDE_PASSWORD_LABEL)).toBeNull();

      fireEvent.press(toggle);

      expect(screen.getByLabelText(HIDE_PASSWORD_LABEL)).toBeTruthy();
      expect(screen.queryByLabelText(SHOW_PASSWORD_LABEL)).toBeNull();

      unmount();
    });
  });

  describe('validation', () => {
    it('blocks submission and reports both fields when nothing is entered', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      fireEvent.press(screen.getByLabelText(SUBMIT_LABEL));

      // These strings come from the real zod schema in login-form.tsx.
      expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();
      expect(screen.getByText('Password is required')).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });

    it('rejects a username shorter than three characters', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('ab', 'correct-horse');

      expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();
      expect(screen.queryByText('Password is required')).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });

    it('accepts a three-character username — the boundary is inclusive', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('abc', 'correct-horse');

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Username must be at least 3 characters')).toBeNull();

      unmount();
    });

    it('rejects an empty password even when the username is valid', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('responder', '');

      expect(await screen.findByText('Password is required')).toBeTruthy();
      expect(screen.queryByText('Username must be at least 3 characters')).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });

    it('accepts a single-character password — the schema sets no minimum length', async () => {
      // Documents the schema as written: only emptiness is rejected.
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('responder', 'x');

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toEqual({ username: 'responder', password: 'x' });

      unmount();
    });

    it('reports the schema message verbatim, never a serialised ZodError', async () => {
      // The controlled fields used to carry their own `rules` whose validate() returned a
      // caught ZodError's `.message` — a JSON blob of issue objects. react-hook-form ignores
      // field-level rules when a resolver is supplied, so they were dead weight that would
      // have gone live (and user-visible) the moment anyone dropped zodResolver. The zod
      // schema is now the single source of truth; this pins the message a user actually sees.
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('ab', '');

      expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();
      expect(screen.getByText('Password is required')).toBeTruthy();
      // A ZodError message serialises its issues, e.g. {"code": "too_small", ...}.
      expect(screen.queryByText(/"code"|too_small|invalid_type/)).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });

    it('validates the username on its own, not against a placeholder password', async () => {
      // The removed username rule parsed {username: value, password: 'placeholder'}, so it
      // could never fail on the password and would have masked an empty one. Both fields
      // must be reported independently.
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('responder', '');

      expect(await screen.findByText('Password is required')).toBeTruthy();
      expect(screen.queryByText('Username must be at least 3 characters')).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });

    it('clears the error once the offending field is corrected and resubmitted', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('ab', 'correct-horse');
      expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();

      fireEvent.changeText(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'responder');
      fireEvent.press(screen.getByLabelText(SUBMIT_LABEL));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Username must be at least 3 characters')).toBeNull();

      unmount();
    });
  });

  describe('submission', () => {
    it('hands the entered credentials to onSubmit', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      await submitWith('responder', 'correct-horse');

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toEqual({ username: 'responder', password: 'correct-horse' });

      unmount();
    });

    it('submits from the keyboard return key and dismisses the keyboard first', async () => {
      const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      fireEvent.changeText(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'responder');
      fireEvent.changeText(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'correct-horse');
      fireEvent(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'submitEditing');

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toEqual({ username: 'responder', password: 'correct-horse' });
      expect(dismissSpy).toHaveBeenCalled();

      dismissSpy.mockRestore();
      unmount();
    });

    it('does not submit from the keyboard when the entry is invalid', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} />);

      fireEvent.changeText(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'ab');
      fireEvent(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'submitEditing');

      expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });

    it('renders without crashing when no onSubmit handler is supplied', async () => {
      // The prop is optional and defaults to a no-op; a valid submit must not throw.
      const { unmount } = render(<LoginForm />);

      await submitWith('responder', 'correct-horse');
      await waitFor(() => expect(screen.queryByText('Username must be at least 3 characters')).toBeNull());

      expect(screen.getByLabelText(SUBMIT_LABEL)).toBeTruthy();

      unmount();
    });
  });

  describe('in-flight state', () => {
    it('swaps the submit control for a spinner and blocks further submits while loading', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} isLoading />);

      expect(screen.getByText('login.login_button_loading')).toBeTruthy();
      // The pressable submit control is gone entirely while a login is in flight.
      expect(screen.queryByLabelText(SUBMIT_LABEL)).toBeNull();

      fireEvent.changeText(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'responder');
      fireEvent.changeText(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'correct-horse');
      fireEvent.press(screen.getByText('login.login_button_loading'));

      await act(async () => {});
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });

    it('restores the submit control when loading finishes', () => {
      const { unmount } = render(<LoginForm isLoading />);

      expect(screen.queryByLabelText(SUBMIT_LABEL)).toBeNull();

      screen.rerender(<LoginForm isLoading={false} />);

      expect(screen.getByLabelText(SUBMIT_LABEL)).toBeTruthy();
      expect(screen.queryByText('login.login_button_loading')).toBeNull();

      unmount();
    });
  });

  describe('error surfacing', () => {
    it('shows the failure message handed down from the login attempt', () => {
      const { unmount } = render(<LoginForm error="Invalid username or password" />);

      expect(screen.getByText('Invalid username or password')).toBeTruthy();

      unmount();
    });

    it('renders no error text when there is no error', () => {
      const { unmount } = render(<LoginForm />);

      expect(screen.queryByText('Invalid username or password')).toBeNull();

      unmount();
    });

    it('clears the message once the error prop goes away', () => {
      const { unmount } = render(<LoginForm error="Invalid username or password" />);

      screen.rerender(<LoginForm error={undefined} />);

      expect(screen.queryByText('Invalid username or password')).toBeNull();

      unmount();
    });

    it('surfaces a rejected login through the banner alone, with no field-level duplicate', () => {
      // The form has exactly one error surface for a rejected login: the banner fed by the
      // `error` prop, which app/login/index.tsx wires to the auth store's failure string.
      // A second, field-level "password was incorrect" message used to be rendered behind a
      // `validated` flag that had no setter and so could never turn false — dead code that
      // read as a live feature. Nothing upstream attributes a failure to a specific field,
      // so the banner stays the single honest path.
      const { unmount } = render(<LoginForm error="Invalid username or password" />);

      expect(screen.getByText('Invalid username or password')).toBeTruthy();
      expect(screen.queryByText('login.password_incorrect')).toBeNull();

      unmount();
    });

    it('keeps the banner and the field validation as separate, non-overlapping surfaces', async () => {
      // A server rejection and a client-side schema failure can be on screen at once; neither
      // may leak into the other's slot.
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} error="Invalid username or password" />);

      await submitWith('ab', '');

      expect(await screen.findByText('Username must be at least 3 characters')).toBeTruthy();
      expect(screen.getByText('Invalid username or password')).toBeTruthy();
      expect(screen.queryByText('login.password_incorrect')).toBeNull();

      unmount();
    });
  });

  describe('secondary affordances', () => {
    it('renders and wires the server URL button only when a handler is supplied', () => {
      const { unmount } = render(<LoginForm />);
      expect(screen.queryByText('settings.server_url')).toBeNull();
      unmount();

      const onServerUrlPress = jest.fn();
      const second = render(<LoginForm onServerUrlPress={onServerUrlPress} />);

      fireEvent.press(screen.getByText('settings.server_url'));
      expect(onServerUrlPress).toHaveBeenCalledTimes(1);

      second.unmount();
    });

    it('renders and wires the SSO button only when a handler is supplied', () => {
      const { unmount } = render(<LoginForm />);
      expect(screen.queryByText('login.sso_button')).toBeNull();
      expect(screen.queryByTestId('shield-check-icon', { includeHiddenElements: true })).toBeNull();
      unmount();

      const onSsoPress = jest.fn();
      const second = render(<LoginForm onSsoPress={onSsoPress} />);

      expect(screen.getByTestId('shield-check-icon', { includeHiddenElements: true })).toBeTruthy();
      fireEvent.press(screen.getByText('login.sso_button'));
      expect(onSsoPress).toHaveBeenCalledTimes(1);

      second.unmount();
    });

    it('does not submit the form when a secondary button is pressed', async () => {
      const onSubmit = jest.fn();
      const { unmount } = render(<LoginForm onSubmit={onSubmit} onServerUrlPress={jest.fn()} onSsoPress={jest.fn()} />);

      // Fill in valid credentials first: with an empty form, validation alone would stop a
      // stray submit and the assertion below would pass for the wrong reason.
      fireEvent.changeText(screen.getByPlaceholderText(USERNAME_PLACEHOLDER), 'responder');
      fireEvent.changeText(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), 'correct-horse');

      fireEvent.press(screen.getByText('settings.server_url'));
      fireEvent.press(screen.getByText('login.sso_button'));

      // handleSubmit resolves asynchronously, so flush before concluding nothing submitted.
      await act(async () => {});
      expect(onSubmit).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('language selector', () => {
    // The trigger's TextInput is aria-hidden by gluestack, so it needs the hidden-element opt-in.
    const getLanguageTrigger = () => screen.getByPlaceholderText('settings.language', { includeHiddenElements: true });

    it('reflects the currently selected language', () => {
      const { unmount } = render(<LoginForm />);

      expect(getLanguageTrigger().props.value).toBe('en');

      unmount();
    });

    it('offers every supported language and reports the choice back to the language hook', async () => {
      const { unmount } = render(
        <GluestackUIProvider>
          <LoginForm />
        </GluestackUIProvider>
      );

      fireEvent.press(getLanguageTrigger());

      // All ten options the form declares must be reachable.
      for (const key of [
        'settings.english',
        'settings.spanish',
        'settings.swedish',
        'settings.german',
        'settings.greek',
        'settings.french',
        'settings.italian',
        'settings.polish',
        'settings.ukrainian',
        'settings.arabic',
      ]) {
        expect(await screen.findByText(key)).toBeTruthy();
      }

      fireEvent.press(screen.getByText('settings.spanish'));

      await waitFor(() => expect(mockSetLanguage).toHaveBeenCalledWith('es'));

      unmount();
    });
  });
});
