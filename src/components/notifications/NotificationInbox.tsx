import { useNotifications } from '@novu/react-native';
import { router } from 'expo-router';
import { CheckCircle, ChevronRight, Circle, ExternalLink, MoreVertical, Trash2, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';

import { deleteMessage } from '@/api/novu/inbox';
import { NotificationDetail } from '@/components/notifications/NotificationDetail';
import { Button } from '@/components/ui/button';
import { FlatList } from '@/components/ui/flat-list';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { logger } from '@/lib/logging';
import { useCoreStore } from '@/stores/app/core-store';
import { useToastStore } from '@/stores/toast/store';
import { type NotificationPayload } from '@/types/notification';

// Constants
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const getSidebarWidth = (windowWidth: number) => Math.min(windowWidth * 0.85, 400);

// lucide-react-native icons default to `stroke="currentColor"`, which react-native-svg resolves
// from the `color` *prop* only — a nativewind `className` lands in `style` and is dropped, so the
// icons rendered near-black on the dark sidebar. Colors are passed explicitly instead.
const getIconColors = (isDark: boolean) =>
  ({
    accent: isDark ? '#60a5fa' : '#3b82f6',
    danger: isDark ? '#f87171' : '#ef4444',
    muted: isDark ? '#9ca3af' : '#6b7280',
  }) as const;

/** Color-dependent style fragments; computed per render from the reactive color scheme. */
const getThemedStyles = (isDark: boolean) =>
  ({
    sidebarContainer: {
      backgroundColor: isDark ? '#171717' : '#fff',
      shadowColor: isDark ? '#262626' : '#e5e5e5',
    },
    header: {
      borderBottomColor: isDark ? '#333333' : '#eee',
    },
    selectionCount: {
      color: isDark ? '#ffffff' : '#000000',
    },
    notificationItem: {
      borderBottomColor: isDark ? '#333333' : '#eee',
    },
    unreadNotificationItem: {
      backgroundColor: isDark ? '#262626' : '#f0f7ff',
    },
    selectedNotificationItem: {
      backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
    },
    unreadIndicator: {
      backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
    },
    notificationBody: {
      color: isDark ? '#e5e5e5' : '#333333',
    },
    unreadNotificationText: {
      color: isDark ? '#ffffff' : '#000000',
    },
    timestamp: {
      color: isDark ? '#a3a3a3' : '#666',
    },
  }) as const;

interface NotificationInboxProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationRowProps {
  notification: NotificationPayload;
  unread: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPress: (notification: NotificationPayload) => void;
  onLongPress: (notification: NotificationPayload) => void;
  onNavigateToReference: (referenceType: string, referenceId: string) => void;
}

const NotificationRow = React.memo(
  ({ notification, unread, isSelectionMode, isSelected, onPress, onLongPress, onNavigateToReference }: NotificationRowProps) => {
    const { colorScheme } = useColorScheme();
    const themed = React.useMemo(() => getThemedStyles(colorScheme === 'dark'), [colorScheme]);
    const iconColors = React.useMemo(() => getIconColors(colorScheme === 'dark'), [colorScheme]);
    const handlePress = React.useCallback(() => onPress(notification), [onPress, notification]);
    const handleLongPress = React.useCallback(() => onLongPress(notification), [onLongPress, notification]);
    const handleNavigate = React.useCallback(
      () => notification.referenceType && notification.referenceId && onNavigateToReference(notification.referenceType, notification.referenceId),
      [onNavigateToReference, notification.referenceType, notification.referenceId]
    );

    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={[styles.notificationItem, themed.notificationItem, unread ? themed.unreadNotificationItem : {}, isSelected ? themed.selectedNotificationItem : {}]}
      >
        {unread ? <View style={[styles.unreadIndicator, themed.unreadIndicator]} /> : null}

        {isSelectionMode ? (
          <View style={styles.selectionIndicator}>{isSelected ? <CheckCircle size={24} color={iconColors.accent} strokeWidth={2} /> : <Circle size={24} color={iconColors.muted} strokeWidth={2} />}</View>
        ) : null}

        <View style={styles.notificationContent}>
          <Text style={[styles.notificationBody, themed.notificationBody, unread ? [styles.unreadNotificationText, themed.unreadNotificationText] : {}]}>{notification.title}</Text>
          <Text style={[styles.timestamp, themed.timestamp]}>
            {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString()}
          </Text>
        </View>

        {!isSelectionMode ? (
          notification.referenceType && notification.referenceId ? (
            <View style={styles.actionButtons}>
              <Button onPress={handleNavigate} variant="outline" className="size-8 p-0">
                <ExternalLink size={24} color={iconColors.accent} strokeWidth={2} />
              </Button>
              <ChevronRight size={24} color={iconColors.muted} strokeWidth={2} style={styles.chevron} />
            </View>
          ) : (
            <ChevronRight size={24} color={iconColors.muted} strokeWidth={2} style={styles.chevron} />
          )
        ) : null}
      </Pressable>
    );
  },
  (prev, next) =>
    prev.notification.id === next.notification.id &&
    prev.notification.title === next.notification.title &&
    prev.notification.createdAt === next.notification.createdAt &&
    prev.notification.referenceType === next.notification.referenceType &&
    prev.notification.referenceId === next.notification.referenceId &&
    prev.unread === next.unread &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.isSelected === next.isSelected
);
NotificationRow.displayName = 'NotificationRow';

export const NotificationInbox = ({ isOpen, onClose }: NotificationInboxProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const sidebarWidth = getSidebarWidth(windowWidth);
  const themed = React.useMemo(() => getThemedStyles(colorScheme === 'dark'), [colorScheme]);
  const iconColors = React.useMemo(() => getIconColors(colorScheme === 'dark'), [colorScheme]);
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const config = useCoreStore((state: any) => state.config);
  const { notifications, isLoading, fetchMore, hasMore, refetch } = useNotifications();
  const showToast = useToastStore((state) => state.showToast);
  const [selectedNotification, setSelectedNotification] = useState<NotificationPayload | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(sidebarWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out and reset state
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: sidebarWidth,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset selection state when closing
      setIsSelectionMode(false);
      setSelectedNotificationIds(new Set());
      setSelectedNotification(null);
      setShowDeleteConfirmModal(false);
    }
  }, [isOpen, slideAnim, fadeAnim, sidebarWidth]);

  const toggleNotificationSelection = React.useCallback((notificationId: string) => {
    setSelectedNotificationIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  }, []);

  const handleNotificationPress = React.useCallback(
    (notification: NotificationPayload) => {
      if (isSelectionMode) {
        toggleNotificationSelection(notification.id);
      } else {
        // Mark unread notifications as read via the Novu SDK; the SDK
        // optimistically updates its cache, refreshing inbox state.
        notification.markAsRead?.();
        setSelectedNotification(notification);
      }
    },
    [isSelectionMode, toggleNotificationSelection]
  );

  const handleNotificationLongPress = React.useCallback(
    (notification: NotificationPayload) => {
      if (!isSelectionMode) {
        setSelectedNotificationIds(new Set([notification.id]));
        setIsSelectionMode(true);
      }
    },
    [isSelectionMode]
  );

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
    setSelectedNotificationIds(new Set());
  };

  const exitSelectionMode = React.useCallback(() => {
    setIsSelectionMode(false);
    setSelectedNotificationIds(new Set());
  }, []);

  const selectAllNotifications = () => {
    const allIds = notifications?.map((item: any) => item.id) || [];
    setSelectedNotificationIds(new Set(allIds));
  };

  const deselectAllNotifications = () => {
    setSelectedNotificationIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedNotificationIds.size > 0) {
      setShowDeleteConfirmModal(true);
    }
  };

  const confirmBulkDelete = React.useCallback(async () => {
    setIsDeletingSelected(true);
    setShowDeleteConfirmModal(false);

    try {
      const deletePromises = Array.from(selectedNotificationIds).map((id) => deleteMessage(id));
      await Promise.all(deletePromises);

      showToast('success', selectedNotificationIds.size > 1 ? t('notifications.removed_count', { count: selectedNotificationIds.size }) : t('notifications.removed_one'));
      exitSelectionMode();
      refetch();
    } catch (error) {
      showToast('error', t('notifications.remove_failed_count'));
    } finally {
      setIsDeletingSelected(false);
    }
  }, [selectedNotificationIds, showToast, exitSelectionMode, refetch, t]);

  const handleDeleteNotification = React.useCallback(
    async (_id: string) => {
      try {
        await deleteMessage(_id);
        showToast('success', t('notifications.removed_one'));
        refetch();
      } catch (error) {
        showToast('error', t('notifications.remove_failed_one'));
      }
    },
    [showToast, refetch, t]
  );

  const handleNavigateToReference = React.useCallback(
    (referenceType: string, referenceId: string) => {
      if (referenceType === 'call') {
        router.push(`/call/${referenceId}`);
        onClose();
      } else {
        logger.info({ message: 'Notification reference navigation not supported for type', context: { referenceType, referenceId } });
      }
    },
    [onClose]
  );

  const renderItem = React.useCallback(
    ({ item }: { item: any }) => {
      const notification: NotificationPayload = {
        id: item.id,
        title: item.subject,
        body: item.body,
        createdAt: item.createdAt,
        read: item.isRead,
        type: item.type,
        referenceId: item.payload?.referenceId,
        referenceType: item.payload?.referenceType,
        metadata: item.payload?.metadata,
        markAsRead:
          !item.isRead && typeof item.read === 'function'
            ? async () => {
                try {
                  await item.read();
                } catch (error) {
                  logger.warn({ message: 'Failed to mark notification as read', context: { error } });
                }
              }
            : undefined,
      };

      return (
        <NotificationRow
          notification={notification}
          unread={!item.isRead}
          isSelectionMode={isSelectionMode}
          isSelected={selectedNotificationIds.has(notification.id)}
          onPress={handleNotificationPress}
          onLongPress={handleNotificationLongPress}
          onNavigateToReference={handleNavigateToReference}
        />
      );
    },
    [isSelectionMode, selectedNotificationIds, handleNotificationPress, handleNotificationLongPress, handleNavigateToReference]
  );

  const renderFooter = () => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2196F3" />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text>{t('notifications.empty')}</Text>
    </View>
  );

  if (!isOpen) {
    return null;
  }

  // Additional safety check to prevent rendering overlay without proper config
  if (!activeUnitId || !config || !config.NovuApplicationId || !config.NovuBackendApiUrl || !config.NovuSocketUrl) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop for tapping outside to close */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Sidebar container */}
      <Animated.View style={[styles.sidebarContainer, themed.sidebarContainer, { width: sidebarWidth, transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
          {selectedNotification ? (
            <NotificationDetail notification={selectedNotification} onClose={() => setSelectedNotification(null)} onDelete={handleDeleteNotification} onNavigateToReference={handleNavigateToReference} />
          ) : (
            <>
              <View style={[styles.header, themed.header]}>
                {isSelectionMode ? (
                  <>
                    <View style={styles.selectionHeader}>
                      <Text style={[styles.selectionCount, themed.selectionCount]}>{t('notifications.selected_count', { count: selectedNotificationIds.size })}</Text>
                      <View style={styles.selectionActions}>
                        <Button onPress={selectedNotificationIds.size === notifications?.length ? deselectAllNotifications : selectAllNotifications} variant="outline" className="mr-2">
                          <Text>{selectedNotificationIds.size === notifications?.length ? t('notifications.deselect_all') : t('notifications.select_all')}</Text>
                        </Button>
                        <Button onPress={handleBulkDelete} variant="outline" className="mr-2" disabled={selectedNotificationIds.size === 0 || isDeletingSelected} accessibilityLabel={t('notifications.delete_selected')}>
                          {isDeletingSelected ? <ActivityIndicator size="small" color={iconColors.danger} /> : <Trash2 size={16} color={iconColors.danger} strokeWidth={2} />}
                        </Button>
                        <Button onPress={exitSelectionMode} variant="outline">
                          <Text>{t('common.cancel')}</Text>
                        </Button>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.headerTitle, themed.selectionCount]}>{t('notifications.title')}</Text>
                    <View style={styles.headerActions}>
                      <Pressable onPress={enterSelectionMode} style={styles.actionButton} accessibilityRole="button" accessibilityLabel={t('notifications.enter_selection_mode')}>
                        <MoreVertical size={24} color={iconColors.accent} strokeWidth={2} />
                      </Pressable>
                      <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                        <X size={24} color={iconColors.accent} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>

              {isLoading && !notifications ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : !activeUnitId || !config ? (
                <View style={styles.loadingContainer}>
                  <Text>{t('notifications.unable_to_load')}</Text>
                </View>
              ) : (
                <FlatList
                  testID="notifications-list"
                  data={notifications}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id}
                  onEndReached={fetchMore}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={renderFooter}
                  ListEmptyComponent={renderEmpty}
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={['#2196F3']} />}
                />
              )}
            </>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirmModal} onClose={() => setShowDeleteConfirmModal(false)} {...({} as any)}>
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Text className="text-lg font-semibold">{t('notifications.confirm_delete_title')}</Text>
          </ModalHeader>
          <ModalBody>
            <Text>{selectedNotificationIds.size > 1 ? t('notifications.confirm_delete_message_count', { count: selectedNotificationIds.size }) : t('notifications.confirm_delete_message_one')}</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onPress={() => setShowDeleteConfirmModal(false)} className="mr-2">
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button variant="solid" onPress={confirmBulkDelete} className="bg-red-500">
              <Text className="text-white">{t('common.delete')}</Text>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  backdropPressable: {
    width: '100%',
    height: '100%',
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT + 16 : 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
  },
  closeButton: {
    padding: 8,
  },
  selectionHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 4,
    height: '100%',
  },
  selectionIndicator: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationBody: {
    fontSize: 16,
    marginBottom: 4,
  },
  unreadNotificationText: {
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
});
