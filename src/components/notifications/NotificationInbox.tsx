import { useNotifications } from '@novu/react-native';
import { X } from 'lucide-react-native';
import { colorScheme } from 'nativewind';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCoreStore } from '@/stores/app/core-store';

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

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.notificationItem}>
      <Text>{item.body}</Text>
    </View>
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
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Icon as={X} size="md" />
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
