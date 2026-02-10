import { router } from 'expo-router';
import { AlertCircle, Bell, MailIcon, MessageCircle, Phone, Users } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { type NotificationType, usePushNotificationModalStore } from '@/stores/push-notification/store';

const NotificationIcon = ({ type }: { type: NotificationType }) => {
  const iconSize = 24;

  switch (type) {
    case 'call':
      return <Phone size={iconSize} className="text-danger-500 dark:text-danger-400" testID="notification-icon" />;
    case 'message':
      return <MailIcon size={iconSize} className="text-primary-500 dark:text-primary-400" testID="notification-icon" />;
    case 'chat':
      return <MessageCircle size={iconSize} className="text-success-500 dark:text-success-400" testID="notification-icon" />;
    case 'group-chat':
      return <Users size={iconSize} className="text-secondary-500 dark:text-secondary-400" testID="notification-icon" />;
    default:
      return <Bell size={iconSize} className="text-gray-600 dark:text-gray-400" testID="notification-icon" />;
  }
};

export const PushNotificationModal: React.FC = () => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const isOpen = usePushNotificationModalStore((s) => s.isOpen);
  const notification = usePushNotificationModalStore((s) => s.notification);
  const hideNotificationModal = usePushNotificationModalStore((s) => s.hideNotificationModal);

  const handleClose = () => {
    if (notification) {
      trackEvent('push_notification_modal_dismissed', {
        type: notification.type,
        id: notification.id,
        eventCode: notification.eventCode,
      });
    }
    hideNotificationModal();
  };

  const handleViewCall = () => {
    if (notification?.type === 'call' && notification.id) {
      trackEvent('push_notification_view_call_pressed', {
        id: notification.id,
        eventCode: notification.eventCode,
      });

      hideNotificationModal();
      router.push(`/call/${notification.id}`);
    }
  };

  const getNotificationTypeText = (type: NotificationType): string => {
    switch (type) {
      case 'call':
        return t('push_notifications.types.call');
      case 'message':
        return t('push_notifications.types.message');
      case 'chat':
        return t('push_notifications.types.chat');
      case 'group-chat':
        return t('push_notifications.types.group_chat');
      default:
        return t('push_notifications.types.notification');
    }
  };

  if (!notification) {
    return null;
  }

  const typeText = getNotificationTypeText(notification.type);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" {...({} as any)}>
      <ModalBackdrop />
      <ModalContent className="mx-4">
        <ModalHeader className="pb-4">
          <HStack className="items-center space-x-3">
            <NotificationIcon type={notification.type} />
            <VStack className="flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('push_notifications.new_notification')}</Text>
              <Text className="text-sm text-gray-600 dark:text-gray-300">{typeText}</Text>
            </VStack>
          </HStack>
        </ModalHeader>

        <ModalBody className="py-4">
          <VStack className="space-y-3">
            {notification.title ? (
              <VStack className="space-y-1">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('push_notifications.title')}</Text>
                <Text className="text-base text-gray-900 dark:text-gray-100">{notification.title}</Text>
              </VStack>
            ) : null}

            {notification.body ? (
              <VStack className="space-y-1">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('push_notifications.message')}</Text>
                <Text className="text-base text-gray-900 dark:text-gray-100">{notification.body}</Text>
              </VStack>
            ) : null}

            {notification.type === 'unknown' ? (
              <HStack className="mt-2 items-center space-x-2 rounded-lg bg-warning-50 p-3 dark:bg-warning-900">
                <AlertCircle size={20} className="text-warning-600 dark:text-warning-400" />
                <Text className="flex-1 text-sm text-warning-800 dark:text-warning-200">{t('push_notifications.unknown_type_warning')}</Text>
              </HStack>
            ) : null}
          </VStack>
        </ModalBody>

        <ModalFooter className="pt-4">
          <HStack className="w-full space-x-3">
            <Button variant="outline" className="flex-1" onPress={handleClose}>
              <ButtonText>{t('common.dismiss')}</ButtonText>
            </Button>

            {notification.type === 'call' && notification.id ? (
              <Button className="flex-1" onPress={handleViewCall}>
                <ButtonText>{t('push_notifications.view_call')}</ButtonText>
              </Button>
            ) : null}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
