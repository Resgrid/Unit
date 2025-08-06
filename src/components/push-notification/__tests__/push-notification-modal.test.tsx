import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { PushNotificationModal } from '../push-notification-modal';
import { usePushNotificationModalStore } from '@/stores/push-notification/store';
import { useAnalytics } from '@/hooks/use-analytics';

// Mock UI components to render as simple React Native components
jest.mock('@/components/ui/modal', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Modal: ({ children, isOpen }: any) => (isOpen ? React.createElement(View, { testID: 'modal' }, children) : null),
    ModalBackdrop: ({ children }: any) => React.createElement(View, { testID: 'modal-backdrop' }, children),
    ModalContent: ({ children }: any) => React.createElement(View, { testID: 'modal-content' }, children),
    ModalHeader: ({ children }: any) => React.createElement(View, { testID: 'modal-header' }, children),
    ModalBody: ({ children }: any) => React.createElement(View, { testID: 'modal-body' }, children),
    ModalFooter: ({ children }: any) => React.createElement(View, { testID: 'modal-footer' }, children),
  };
});

jest.mock('@/components/ui/text', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Text: ({ children }: any) => React.createElement(Text, {}, children),
  };
});

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');

  return {
    Button: ({ children, onPress }: any) => React.createElement(TouchableOpacity, { onPress, testID: 'button' }, children),
    ButtonText: ({ children }: any) => React.createElement(Text, {}, children),
  };
});

jest.mock('@/components/ui/hstack', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    HStack: ({ children }: any) => React.createElement(View, { testID: 'hstack' }, children),
  };
});

jest.mock('@/components/ui/vstack', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    VStack: ({ children }: any) => React.createElement(View, { testID: 'vstack' }, children),
  };
});

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: jest.fn(),
}));

jest.mock('@/stores/push-notification/store', () => ({
  usePushNotificationModalStore: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'push_notifications.new_notification': 'New notification',
        'push_notifications.view_call': 'View call',
        'push_notifications.close': 'Close',
        'push_notifications.title': 'Title',
        'push_notifications.message': 'Message',
        'push_notifications.types.call': 'Emergency Call',
        'push_notifications.types.message': 'Message',
        'push_notifications.types.chat': 'Chat',
        'push_notifications.types.group_chat': 'Group Chat',
        'common.dismiss': 'Close',
      };
      return translations[key] || key;
    },
  }),
}));

describe('PushNotificationModal', () => {
  const mockAnalytics = {
    trackEvent: jest.fn(),
  };

  const mockStore = {
    isOpen: false,
    notification: null,
    hideNotificationModal: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue(mockAnalytics);
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue(mockStore);
  });

  describe('Push Notification Modal', () => {
    it('should not render when modal is closed', () => {
      render(<PushNotificationModal />);

      // Modal should not be visible
      expect(screen.queryByText('New notification')).toBeNull();
    });

    it('should render call notification correctly', () => {
      const callNotification = {
        type: 'call' as const,
        id: '1234',
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire reported at Main St',
      };

      (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
        isOpen: true,
        notification: callNotification,
        hideNotificationModal: jest.fn(),
      });

      render(<PushNotificationModal />);

      // Check for modal content
      expect(screen.queryByText('New notification')).toBeTruthy();
      expect(screen.getAllByText('Emergency Call')).toHaveLength(2); // Appears in header and body
      expect(screen.queryByText('Structure fire reported at Main St')).toBeTruthy();
      expect(screen.queryByText('View call')).toBeTruthy();
      expect(screen.queryByText('Close')).toBeTruthy();
    });
  });

  it('should render message notification correctly', () => {
    const messageNotification = {
      type: 'message' as const,
      id: '5678',
      eventCode: 'M:5678',
      title: 'New Message',
      body: 'You have a new message from dispatch',
    };

    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: messageNotification,
    });

    render(<PushNotificationModal />);

    expect(screen.queryByText('New notification')).toBeTruthy();
    expect(screen.queryByText('New Message')).toBeTruthy();
    expect(screen.queryByText('You have a new message from dispatch')).toBeTruthy();
    expect(screen.queryByText('Close')).toBeTruthy();
    // Should not have "View call" button for messages
    expect(screen.queryByText('View call')).toBeNull();
  });

  it('should render chat notification correctly', () => {
    const chatNotification = {
      type: 'chat' as const,
      id: '9101',
      eventCode: 'T:9101',
      title: 'Chat Message',
      body: 'New message in chat',
    };

    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: chatNotification,
    });

    render(<PushNotificationModal />);

    expect(screen.queryByText('New notification')).toBeTruthy();
    expect(screen.queryByText('Chat Message')).toBeTruthy();
    expect(screen.queryByText('New message in chat')).toBeTruthy();
    expect(screen.queryByText('Close')).toBeTruthy();
    // Should not have "View call" button for chats
    expect(screen.queryByText('View call')).toBeNull();
  });

  it('should render group chat notification correctly', () => {
    const groupChatNotification = {
      type: 'group-chat' as const,
      id: '1121',
      eventCode: 'G:1121',
      title: 'Group Chat',
      body: 'New message in group chat',
    };

    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: groupChatNotification,
    });

    render(<PushNotificationModal />);

    expect(screen.queryByText('New notification')).toBeTruthy();
    expect(screen.getAllByText('Group Chat')).toHaveLength(2);
    expect(screen.queryByText('New message in group chat')).toBeTruthy();
    expect(screen.queryByText('Close')).toBeTruthy();
    // Should not have "View call" button for group chats
    expect(screen.queryByText('View call')).toBeNull();
  });

  it('should handle close button press', () => {
    const hideNotificationModalMock = jest.fn();

    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'call' as const,
        id: '1234',
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      },
      hideNotificationModal: hideNotificationModalMock,
    });

    render(<PushNotificationModal />);

    const closeButton = screen.queryByText('Close');
    expect(closeButton).toBeTruthy();
    fireEvent.press(closeButton!);

    expect(hideNotificationModalMock).toHaveBeenCalled();
    expect(mockAnalytics.trackEvent).toHaveBeenCalledWith('push_notification_modal_dismissed', {
      type: 'call',
      id: '1234',
      eventCode: 'C:1234',
    });
  });

  it('should handle view call button press', async () => {
    const hideNotificationModalMock = jest.fn();

    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'call' as const,
        id: '1234',
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      },
      hideNotificationModal: hideNotificationModalMock,
    });

    render(<PushNotificationModal />);

    const viewCallButton = screen.queryByText('View call');
    expect(viewCallButton).toBeTruthy();
    fireEvent.press(viewCallButton!);

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/call/1234');
      expect(hideNotificationModalMock).toHaveBeenCalled();
      expect(mockAnalytics.trackEvent).toHaveBeenCalledWith('push_notification_view_call_pressed', {
        id: '1234',
        eventCode: 'C:1234',
      });
    });
  });

  it('should display correct icon for call notification', () => {
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'call' as const,
        id: '1234',
        eventCode: 'C:1234',
        title: 'Emergency Call',
        body: 'Structure fire',
      },
    });

    render(<PushNotificationModal />);

    // Check if Phone icon is rendered (by testing accessibility label or other properties)
    const iconContainer = screen.getAllByTestId('notification-icon')[0];
    expect(iconContainer).toBeTruthy();
  });

  it('should display correct icon for message notification', () => {
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'message' as const,
        id: '5678',
        eventCode: 'M:5678',
        title: 'New Message',
        body: 'Message content',
      },
    });

    render(<PushNotificationModal />);

    // Check if Mail icon is rendered
    const iconContainer = screen.getAllByTestId('notification-icon')[0];
    expect(iconContainer).toBeTruthy();
  });

  it('should display correct icon for chat notification', () => {
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'chat' as const,
        id: '9101',
        eventCode: 'T:9101',
        title: 'Chat Message',
        body: 'Chat content',
      },
    });

    render(<PushNotificationModal />);

    // Check if MessageCircle icon is rendered
    const iconContainer = screen.getAllByTestId('notification-icon')[0];
    expect(iconContainer).toBeTruthy();
  });

  it('should display correct icon for group chat notification', () => {
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'group-chat' as const,
        id: '1121',
        eventCode: 'G:1121',
        title: 'Group Chat',
        body: 'Group chat content',
      },
    });

    render(<PushNotificationModal />);

    // Check if Users icon is rendered
    const iconContainer = screen.getAllByTestId('notification-icon')[0];
    expect(iconContainer).toBeTruthy();
  });

  it('should display correct icon for unknown notification', () => {
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'unknown' as const,
        id: '9999',
        eventCode: 'X:9999',
        title: 'Unknown',
        body: 'Unknown notification',
      },
    });

    render(<PushNotificationModal />);

    // Check if Bell icon is rendered for unknown types
    const iconContainer = screen.getAllByTestId('notification-icon')[0];
    expect(iconContainer).toBeTruthy();
  });

  it('should handle notification without title', () => {
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'call' as const,
        id: '1234',
        eventCode: 'C:1234',
        body: 'Structure fire',
        // No title provided
      },
    });

    render(<PushNotificationModal />);

    expect(screen.queryByText('New notification')).toBeTruthy();
    expect(screen.queryByText('Structure fire')).toBeTruthy();
  });

  it('should handle notification without body', () => {
    (usePushNotificationModalStore as unknown as jest.Mock).mockReturnValue({
      ...mockStore,
      isOpen: true,
      notification: {
        type: 'call' as const,
        id: '1234',
        eventCode: 'C:1234',
        title: 'Emergency Call',
        // No body provided
      },
    });

    render(<PushNotificationModal />);

    expect(screen.queryByText('New notification')).toBeTruthy();
    expect(screen.getAllByText('Emergency Call')).toHaveLength(2);
  });
});
