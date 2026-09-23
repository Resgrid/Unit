/**
 * The real inbox and detail with their data sources mocked. Covers the Novu v2 -> v3 field fix
 * (the inbox read `payload`, so no reference ever arrived) and call/chat links derived from the
 * push event code the Novu bridge copies into the in-app `data`.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
jest.mock('@novu/react-native', () => ({ useNotifications: jest.fn() }));
jest.mock('@/stores/app/core-store', () => ({ useCoreStore: jest.fn() }));
jest.mock('@/stores/toast/store', () => ({ useToastStore: jest.fn() }));
jest.mock('@/api/novu/inbox', () => ({ deleteMessage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({ 'notifications.view_call': 'View Call', 'notifications.view_chat': 'View Chat', 'notifications.open_reference': 'Open', 'notifications.detail_title': 'Notification' })[key] ?? key,
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

import { NotificationDetail } from '../NotificationDetail';
import { mapNovuNotification, NotificationInbox } from '../NotificationInbox';

type NovuItem = Parameters<typeof mapNovuNotification>[0];
const item = (data: Record<string, unknown> | undefined, id = 'n-1', isRead = false) =>
  ({ id, subject: 'Structure Fire', body: 'Engine 6 respond', createdAt: '2026-09-22T10:00:00Z', isRead, data }) as unknown as NovuItem;

describe('mapNovuNotification', () => {
  it('reads the v3 fields and derives call and chat links from the event code', () => {
    const call = mapNovuNotification(item({ eventCode: 'C1234', type: '0' }));
    expect(call).toEqual(expect.objectContaining({ title: 'Structure Fire', read: false, referenceType: 'call', referenceId: '1234', type: '0', metadata: { type: '0' } }));

    expect(mapNovuNotification(item({ eventCode: 'g:7f1c' }))).toEqual(expect.objectContaining({ referenceType: 'chat', referenceId: '7f1c' }));
    expect(mapNovuNotification(item({ eventCode: 'g:../call/9' })).referenceType).toBeUndefined();
    expect(mapNovuNotification(item(undefined)).metadata).toBeUndefined();
  });

  it('ignores the v2 payload field', () => {
    const v2 = { id: 'n-2', subject: 'x', body: 'y', createdAt: '2026-09-22T10:00:00Z', isRead: true, payload: { referenceType: 'call', referenceId: '9' } } as unknown as NovuItem;
    expect(mapNovuNotification(v2).referenceType).toBeUndefined();
  });
});

describe('NotificationInbox references', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCoreStore as unknown as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ activeUnitId: '12', config: { NovuApplicationId: 'app', NovuBackendApiUrl: 'api', NovuSocketUrl: 'socket' } })
    );
    (useToastStore as unknown as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) => selector({ showToast: jest.fn() }));
  });

  const withItems = (items: NovuItem[]) => (useNotifications as jest.Mock).mockReturnValue({ notifications: items, isLoading: false, fetchMore: jest.fn(), hasMore: false, refetch: jest.fn() });

  it('opens the dispatched call and closes the inbox', () => {
    withItems([item({ eventCode: 'C1234' }, 'call-1')]);
    const onClose = jest.fn();

    render(<NotificationInbox isOpen onClose={onClose} />);
    fireEvent.press(screen.getByTestId('notification-reference-call-1'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '1234' } });
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the chat conversation', () => {
    withItems([item({ eventCode: 't:9a2b' }, 'chat-1')]);

    render(<NotificationInbox isOpen onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('notification-reference-chat-1'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/chat/[channelId]', params: { channelId: '9a2b' } });
  });

  it('shows no link for a notification without a code', () => {
    withItems([item({ eventCode: '' }, 'plain-1')]);

    render(<NotificationInbox isOpen onClose={jest.fn()} />);

    expect(screen.queryByTestId('notification-reference-plain-1')).toBeNull();
  });
});

describe('NotificationDetail reference button', () => {
  const base = { id: 'n-1', title: 'Structure Fire', body: 'Engine 6 respond', createdAt: '2026-09-22T10:00:00Z' };

  it.each([
    ['call', 'View Call'],
    ['chat', 'View Chat'],
    ['note', 'Open'],
  ])('labels a %s reference as %s', (referenceType, label) => {
    const onNavigateToReference = jest.fn();
    render(<NotificationDetail notification={{ ...base, referenceType, referenceId: 'ref-1' }} onClose={jest.fn()} onDelete={jest.fn()} onNavigateToReference={onNavigateToReference} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Notification')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-detail-reference'));
    expect(onNavigateToReference).toHaveBeenCalledWith(referenceType, 'ref-1');
  });
});
