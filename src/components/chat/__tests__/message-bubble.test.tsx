/**
 * The conversation list re-renders on every chat-store update (typing, presence, a
 * sibling message arriving). Before MessageBubble was memoized, each of those repainted
 * every visible bubble and re-ran linkifySegments per bubble. The memo only holds if
 * callers pass stable handlers, which the channel screen now does via useCallback.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/api/chat/chat', () => ({
  getChatAttachmentImageSource: (id: string) => ({ uri: `https://example.test/${id}` }),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => React.createElement(View, props) };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const icon = React.forwardRef((props: Record<string, unknown>, ref: unknown) => React.createElement(View, { ...props, ref }));
  return new Proxy({}, { get: () => icon });
});

// formatShortTime runs once per bubble render, so its call count is a render counter.
const mockFormatShortTime = jest.fn((_iso?: string | null) => '10:00');
const mockLinkifySegments = jest.fn((body: string) => jest.requireActual('../chat-utils').linkifySegments(body));

jest.mock('../chat-utils', () => ({
  ...jest.requireActual('../chat-utils'),
  formatShortTime: (iso?: string | null) => mockFormatShortTime(iso),
  linkifySegments: (body: string) => mockLinkifySegments(body),
}));

import { ChatMessagePriority, type ChatMessageResultData, ChatMessageType } from '@/models/v4/chat';

import { MessageBubble } from '../message-bubble';

const buildMessage = (overrides: Partial<ChatMessageResultData> = {}): ChatMessageResultData =>
  ({
    ChatMessageId: 'm1',
    ChatChannelId: 'c1',
    SenderUserId: 'user-2',
    SenderDisplayName: 'Engine 6',
    Body: 'Arriving on scene',
    MessageType: ChatMessageType.Text,
    Priority: ChatMessagePriority.Normal,
    SentOn: '2024-01-01T10:00:00Z',
    ThreadReplyCount: 0,
    Reactions: [],
    Attachments: [],
    ...overrides,
  }) as ChatMessageResultData;

const stableHandlers = {
  onLongPress: jest.fn(),
  onToggleReaction: jest.fn(),
  onRetry: jest.fn(),
};

describe('MessageBubble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the message body', () => {
    const { unmount } = render(<MessageBubble message={buildMessage()} isOwn={false} showSender currentUserId="user-1" {...stableHandlers} />);

    expect(screen.getByText('Arriving on scene')).toBeTruthy();

    unmount();
  });

  it('does not re-render when the parent repaints with identical props', () => {
    const message = buildMessage();
    const element = <MessageBubble message={message} isOwn={false} showSender currentUserId="user-1" {...stableHandlers} />;

    const { rerender, unmount } = render(element);
    expect(mockFormatShortTime).toHaveBeenCalledTimes(1);

    // Same message object and same handler identities: the memo must short-circuit.
    rerender(element);
    rerender(element);

    expect(mockFormatShortTime).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('re-renders when its own message changes', () => {
    const { rerender, unmount } = render(<MessageBubble message={buildMessage()} isOwn={false} showSender currentUserId="user-1" {...stableHandlers} />);
    expect(mockFormatShortTime).toHaveBeenCalledTimes(1);

    rerender(<MessageBubble message={buildMessage({ Body: 'Clearing scene' })} isOwn={false} showSender currentUserId="user-1" {...stableHandlers} />);

    expect(mockFormatShortTime).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Clearing scene')).toBeTruthy();

    unmount();
  });

  it('re-runs linkify only when the body text changes', () => {
    const message = buildMessage({ Body: 'See https://resgrid.com for details' });
    const element = <MessageBubble message={message} isOwn={false} showSender currentUserId="user-1" {...stableHandlers} />;

    const { rerender, unmount } = render(element);
    const afterFirstRender = mockLinkifySegments.mock.calls.length;
    expect(afterFirstRender).toBeGreaterThan(0);

    // A reaction change re-renders the bubble but must not re-scan the unchanged body.
    rerender(<MessageBubble message={message} isOwn={false} showSender currentUserId="user-3" {...stableHandlers} />);

    expect(mockLinkifySegments.mock.calls.length).toBe(afterFirstRender);

    unmount();
  });

  it('renders a fresh inline handler as a prop change, confirming the memo compares identities', () => {
    const message = buildMessage();

    const { rerender, unmount } = render(<MessageBubble message={message} isOwn={false} showSender currentUserId="user-1" {...stableHandlers} onRetry={() => undefined} />);
    expect(mockFormatShortTime).toHaveBeenCalledTimes(1);

    // This is exactly what the channel screen used to do per item; it defeats the memo,
    // which is why onRetry is now a useCallback there.
    rerender(<MessageBubble message={message} isOwn={false} showSender currentUserId="user-1" {...stableHandlers} onRetry={() => undefined} />);

    expect(mockFormatShortTime).toHaveBeenCalledTimes(2);

    unmount();
  });
});
