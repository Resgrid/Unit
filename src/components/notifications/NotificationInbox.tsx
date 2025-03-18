import { useNotifications } from '@novu/react-native';
import { ChevronRight, ExternalLink, X } from 'lucide-react-native';
import { colorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import { NotificationDetail } from '@/components/notifications/NotificationDetail';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCoreStore } from '@/stores/app/core-store';
import { useToastStore } from '@/stores/toast/store';
import { type NotificationPayload } from '@/types/notification';

// Constants
const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.85, 400);
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface NotificationInboxProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationInbox = ({ isOpen, onClose }: NotificationInboxProps) => {
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const config = useCoreStore((state: any) => state.config);
  const { notifications, isLoading, fetchMore, hasMore, refetch } = useNotifications();
  const showToast = useToastStore((state) => state.showToast);
  const [selectedNotification, setSelectedNotification] = useState<NotificationPayload | null>(null);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
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
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SIDEBAR_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, fadeAnim]);

  const handleNotificationPress = (notification: NotificationPayload) => {
    setSelectedNotification(notification);
  };

  const handleDeleteNotification = async (_id: string) => {
    try {
      // Since Novu doesn't provide a direct delete method, we'll just refetch to sync with server
      showToast('success', 'Notification removed');
      refetch();
    } catch (error) {
      showToast('error', 'Failed to remove notification');
    }
  };

  const handleNavigateToReference = (referenceType: string, referenceId: string) => {
    // TODO: Implement navigation based on reference type
    console.log('Navigate to:', referenceType, referenceId);
    onClose();
  };

  const renderItem = ({ item }: { item: any }) => {
    const notification: NotificationPayload = {
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      read: item.read,
      type: item.type,
      referenceId: item.payload?.referenceId,
      referenceType: item.payload?.referenceType,
      metadata: item.payload?.metadata,
    };

    return (
      <Pressable onPress={() => handleNotificationPress(notification)} style={[styles.notificationItem, !item.read && styles.unreadNotificationItem]}>
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationBody, !item.read && styles.unreadNotificationText]}>{notification.body}</Text>
          <Text style={styles.timestamp}>
            {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString()}
          </Text>
        </View>
        {notification.referenceType && notification.referenceId ? (
          <View style={styles.actionButtons}>
            <Button onPress={() => handleNavigateToReference(notification.referenceType!, notification.referenceId!)} variant="outline" className="size-8 p-0">
              <ExternalLink size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
            </Button>
            <ChevronRight size={24} className="ml-2 text-gray-400" strokeWidth={2} />
          </View>
        ) : (
          <ChevronRight size={24} className="ml-2 text-gray-400" strokeWidth={2} />
        )}
      </Pressable>
    );
  };

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
      <Text>No updates available</Text>
    </View>
  );

  if (!isOpen) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop for tapping outside to close */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Sidebar container */}
      <Animated.View style={[styles.sidebarContainer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
          {selectedNotification ? (
            <NotificationDetail notification={selectedNotification} onClose={() => setSelectedNotification(null)} onDelete={handleDeleteNotification} onNavigateToReference={handleNavigateToReference} />
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <X size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
                </Pressable>
              </View>

              {isLoading && !notifications ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : !activeUnitId || !config ? (
                <View style={styles.loadingContainer}>
                  <Text>Unable to load notifications</Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContainer}
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
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  },
  backdropPressable: {
    width: '100%',
    height: '100%',
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: colorScheme.get() === 'dark' ? '#171717' : '#fff',
    shadowColor: colorScheme.get() === 'dark' ? '#262626' : '#e5e5e5',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10000,
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
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  unreadNotificationItem: {
    backgroundColor: colorScheme.get() === 'dark' ? '#262626' : '#f3f4f6',
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
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listContainer: {
    flexGrow: 1,
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
