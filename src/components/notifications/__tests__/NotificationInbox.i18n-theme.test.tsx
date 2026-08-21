/**
 * Renders the real NotificationInbox (the sibling suite substitutes a hand-written
 * stand-in, so it never exercised this file). Covers the two regressions fixed here:
 * hardcoded English copy, and a theme frozen at module-evaluation time because the
 * colors were baked into a module-scope StyleSheet via Appearance.getColorScheme().
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

let mockColorScheme = 'light';

// Only useColorScheme is overridden; gluestack needs the real `styled` from this module.
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));

jest.mock('@novu/react-native', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn(),
}));

jest.mock('@/api/novu/inbox', () => ({
  deleteMessage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/components/notifications/NotificationDetail', () => ({
  NotificationDetail: () => null,
}));

// Interpolated values are surfaced so assertions can prove the count reaches t().
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options && 'count' in options ? `${key}:${options.count}` : key),
  }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const icon = React.forwardRef((props: Record<string, unknown>, ref: unknown) => React.createElement(View, { ...props, ref }));
  return new Proxy({}, { get: () => icon });
});

import { useNotifications } from '@novu/react-native';

import { useCoreStore } from '@/stores/app/core-store';
import { useToastStore } from '@/stores/toast/store';

import { NotificationInbox } from '../NotificationInbox';

const mockUseNotifications = useNotifications as unknown as jest.Mock;
const mockUseCoreStore = useCoreStore as unknown as jest.Mock;
const mockUseToastStore = useToastStore as unknown as jest.Mock;

const notifications = [
  {
    id: '1',
    subject: 'Structure fire dispatched',
    body: 'Engine 6 responding',
    createdAt: '2024-01-01T10:00:00Z',
    isRead: false,
    type: 'info',
    payload: {},
  },
];

/** Flattens the RN style prop (arrays/nested arrays) into one object. */
const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (Array.isArray(style)) return style.reduce<Record<string, unknown>>((acc, entry) => ({ ...acc, ...flattenStyle(entry) }), {});
  return (style ?? {}) as Record<string, unknown>;
};

/** Every backgroundColor present anywhere in the rendered tree. */
const collectBackgroundColors = (node: unknown): string[] => {
  if (!node || typeof node !== 'object') return [];
  const element = node as { props?: { style?: unknown }; children?: unknown[] };
  const own = flattenStyle(element.props?.style).backgroundColor;
  const fromChildren = (element.children ?? []).flatMap(collectBackgroundColors);
  return typeof own === 'string' ? [own, ...fromChildren] : fromChildren;
};

describe('NotificationInbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockColorScheme = 'light';

    mockUseNotifications.mockReturnValue({
      notifications,
      isLoading: false,
      fetchMore: jest.fn(),
      hasMore: false,
      refetch: jest.fn(),
    });

    mockUseCoreStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        activeUnitId: 'unit-1',
        config: {
          NovuApplicationId: 'app-id',
          NovuBackendApiUrl: 'backend-url',
          NovuSocketUrl: 'socket-url',
        },
      })
    );

    mockUseToastStore.mockImplementation((selector: (state: unknown) => unknown) => selector({ showToast: jest.fn() }));
  });

  it('renders header and controls through t() rather than hardcoded English', () => {
    const { unmount } = render(<NotificationInbox isOpen onClose={jest.fn()} />);

    expect(screen.getByText('notifications.title')).toBeTruthy();
    expect(screen.queryByText('Notifications')).toBeNull();

    unmount();
  });

  it('labels the icon-only header controls for screen readers', () => {
    const { unmount } = render(<NotificationInbox isOpen onClose={jest.fn()} />);

    expect(screen.getByLabelText('notifications.enter_selection_mode')).toBeTruthy();
    expect(screen.getByLabelText('common.close')).toBeTruthy();

    unmount();
  });

  it('renders the translated empty state when there are no notifications', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      isLoading: false,
      fetchMore: jest.fn(),
      hasMore: false,
      refetch: jest.fn(),
    });

    const { unmount } = render(<NotificationInbox isOpen onClose={jest.fn()} />);

    expect(screen.getByText('notifications.empty')).toBeTruthy();
    expect(screen.queryByText('No updates available')).toBeNull();

    unmount();
  });

  it('repaints the sidebar when the color scheme changes', () => {
    const { toJSON, unmount } = render(<NotificationInbox isOpen onClose={jest.fn()} />);

    expect(collectBackgroundColors(toJSON())).toContain('#fff');

    // A scheme flip must repaint without an app restart — the previous module-scope
    // Appearance.getColorScheme() baked these colors in at import time, so the sidebar
    // kept the scheme that was active when the bundle first loaded.
    mockColorScheme = 'dark';
    screen.rerender(<NotificationInbox isOpen onClose={jest.fn()} />);

    const darkBackgrounds = collectBackgroundColors(toJSON());
    expect(darkBackgrounds).toContain('#171717');
    expect(darkBackgrounds).not.toContain('#fff');

    unmount();
  });

  it('sizes the sidebar from the current window width rather than a frozen Dimensions read', () => {
    const { toJSON, unmount } = render(<NotificationInbox isOpen onClose={jest.fn()} />);

    // jest-expo reports a 750pt-wide window; 85% of that is below the 400 cap.
    const widths: unknown[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const element = node as { props?: { style?: unknown }; children?: unknown[] };
      const width = flattenStyle(element.props?.style).width;
      if (typeof width === 'number') widths.push(width);
      (element.children ?? []).forEach(walk);
    };
    walk(toJSON());

    expect(widths).toContain(400);

    unmount();
  });

  it('renders nothing when Novu config is incomplete', () => {
    mockUseCoreStore.mockImplementation((selector: (state: unknown) => unknown) => selector({ activeUnitId: null, config: null }));

    const { toJSON, unmount } = render(<NotificationInbox isOpen onClose={jest.fn()} />);

    expect(toJSON()).toBeNull();

    unmount();
  });
});
