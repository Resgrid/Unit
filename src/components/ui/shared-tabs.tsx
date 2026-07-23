import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { create } from 'zustand';

import { Box } from '@/components/ui/box';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';

// Tab state management with zustand
interface TabState {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const useTabStore = create<TabState>((set) => ({
  activeIndex: 0,
  setActiveIndex: (index) => set({ activeIndex: index }),
}));

// Types for the tab items
export interface TabItem {
  key: string;
  title: string | React.ReactNode;
  content: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number;
  badgeVariant?: 'critical' | 'warning';
}

interface SharedTabsProps {
  tabs: TabItem[];
  initialIndex?: number;
  scrollable?: boolean;
  variant?: 'default' | 'pills' | 'underlined' | 'segmented';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  tabClassName?: string;
  tabsContainerClassName?: string;
  contentClassName?: string;
  showOverflowIndicators?: boolean;
  onChange?: (index: number) => void;
}

interface ScrollMetrics {
  contentWidth: number;
  offsetX: number;
  viewportWidth: number;
}

interface OverflowState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

const OVERFLOW_TOLERANCE = 2;
const getBadgeContainerClassName = (badgeVariant: TabItem['badgeVariant']): string => {
  const backgroundClassName = badgeVariant === 'warning' ? 'bg-warning-500' : 'bg-error-500';
  return `absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full px-1 ${backgroundClassName}`;
};

const getBadgeTextClassName = (badgeVariant: TabItem['badgeVariant']): string => {
  const textClassName = badgeVariant === 'warning' ? 'text-typography-950' : 'text-typography-white';
  return `text-2xs font-bold ${textClassName}`;
};

export const SharedTabs: React.FC<SharedTabsProps> = ({
  tabs,
  initialIndex = 0,
  scrollable = true,
  variant = 'default',
  size = 'md',
  className = '',
  tabClassName = '',
  tabsContainerClassName = '',
  contentClassName = '',
  showOverflowIndicators = false,
  onChange,
}) => {
  const { t } = useTranslation();
  const [localActiveIndex, setLocalActiveIndex] = useState(initialIndex);
  const activeIndex = useTabStore((s) => s.activeIndex);
  const setActiveIndex = useTabStore((s) => s.setActiveIndex);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { colorScheme } = useColorScheme();
  const scrollMetricsRef = useRef<ScrollMetrics>({ contentWidth: 0, offsetX: 0, viewportWidth: 0 });
  const [overflowState, setOverflowState] = useState<OverflowState>({ canScrollLeft: false, canScrollRight: false });

  // Use local state if no external state management is needed
  const currentIndex = onChange ? activeIndex : localActiveIndex;

  const updateOverflowState = useCallback(() => {
    const { contentWidth, offsetX, viewportWidth } = scrollMetricsRef.current;
    const nextState = {
      canScrollLeft: offsetX > OVERFLOW_TOLERANCE,
      canScrollRight: contentWidth - viewportWidth - offsetX > OVERFLOW_TOLERANCE,
    };

    setOverflowState((currentState) => {
      if (currentState.canScrollLeft === nextState.canScrollLeft && currentState.canScrollRight === nextState.canScrollRight) {
        return currentState;
      }
      return nextState;
    });
  }, []);

  const handleScrollViewLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scrollMetricsRef.current.viewportWidth = event.nativeEvent.layout.width;
      updateOverflowState();
    },
    [updateOverflowState]
  );

  const handleContentSizeChange = useCallback(
    (contentWidth: number) => {
      scrollMetricsRef.current.contentWidth = contentWidth;
      updateOverflowState();
    },
    [updateOverflowState]
  );

  const handleHeaderScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollMetricsRef.current.offsetX = Math.max(0, event.nativeEvent.contentOffset.x);
      updateOverflowState();
    },
    [updateOverflowState]
  );

  const handleTabPress = useCallback(
    (index: number) => {
      if (onChange) {
        setActiveIndex(index);
        onChange(index);
      } else {
        setLocalActiveIndex(index);
      }
    },
    [onChange, setActiveIndex]
  );

  // Get appropriate text color based on theme
  const getTextColor = () => {
    return colorScheme === 'dark' ? 'text-gray-200' : 'text-gray-800';
  };

  // Determine tab styles based on variant and size
  const getTabStyles = (index: number) => {
    const isActive = index === currentIndex;

    const baseStyles = 'flex-row items-center justify-center relative';
    const sizeStyles = {
      sm: isLandscape ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-2xs',
      md: isLandscape ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs',
      lg: isLandscape ? 'px-5 py-2.5 text-base' : 'px-4 py-2 text-sm',
    }[size];

    const variantStyles = {
      default: isActive ? 'border-b-2 border-primary-500 text-primary-500' : `border-b-2 border-transparent ${colorScheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`,
      pills: isActive ? 'bg-primary-500 text-white rounded-full' : `bg-transparent ${colorScheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`,
      underlined: isActive ? 'border-b-2 border-primary-500 text-primary-500' : `border-b-2 border-transparent ${colorScheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`,
      segmented: isActive ? 'bg-primary-500 text-white' : `${colorScheme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`,
    }[variant];

    return `${baseStyles} ${sizeStyles} ${variantStyles} ${tabClassName}`;
  };

  // Container styles based on variant
  const getContainerStyles = () => {
    const baseStyles = 'flex flex-row';

    const variantStyles = {
      default: colorScheme === 'dark' ? 'border-b border-gray-700' : 'border-b border-gray-200',
      pills: 'space-x-2 p-1',
      underlined: colorScheme === 'dark' ? 'border-b border-gray-700' : 'border-b border-gray-200',
      segmented: colorScheme === 'dark' ? 'bg-gray-800 p-1 rounded-lg' : 'bg-gray-100 p-1 rounded-lg',
    }[variant];

    return `${baseStyles} ${variantStyles} overflow-visible ${tabsContainerClassName}`;
  };

  // Convert Tailwind classes to style object
  const getContainerStyle = () => {
    const borderColor = colorScheme === 'dark' ? '#374151' : '#e5e7eb';
    const backgroundColor = colorScheme === 'dark' ? '#1f2937' : '#f3f4f6';

    const styles = StyleSheet.create({
      container: {
        flexDirection: 'row',
        flexGrow: 1,
        paddingTop: 8,
        overflow: 'visible',
        ...(variant === 'default' && { borderBottomWidth: 1, borderBottomColor: borderColor }),
        ...(variant === 'pills' && { gap: 8, padding: 4, paddingTop: 12 }),
        ...(variant === 'underlined' && { borderBottomWidth: 1, borderBottomColor: borderColor }),
        ...(variant === 'segmented' && { backgroundColor, padding: 4, paddingTop: 12, borderRadius: 8 }),
      },
    });
    return styles.container;
  };

  return (
    <Box className={`w-full overflow-visible ${className}`}>
      {/* Tab Headers */}
      {scrollable ? (
        <Box className="relative">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={getContainerStyle()}
            onLayout={handleScrollViewLayout}
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleHeaderScroll}
            scrollEventThrottle={16}
            testID="shared-tabs-scroll-view"
          >
            {tabs.map((tab, index) => (
              <Pressable key={tab.key} testID={`shared-tab-${tab.key}`} className={`${getTabStyles(index)} relative`} style={styles.scrollableTab} onPress={() => handleTabPress(index)}>
                <Box className="flex-row items-center justify-center">
                  {tab.icon ? <Box className={isLandscape ? 'mr-1.5' : 'mr-1'}>{tab.icon}</Box> : null}
                  {typeof tab.title === 'string' ? (
                    <Text className={isLandscape ? getTextColor() : `text-xs ${getTextColor()}`} numberOfLines={1} style={styles.tabLabel}>
                      {t(tab.title)}
                    </Text>
                  ) : (
                    <Text className={isLandscape ? getTextColor() : `text-xs ${getTextColor()}`} numberOfLines={1} style={styles.tabLabel}>
                      {tab.title}
                    </Text>
                  )}
                </Box>
                {tab.badge !== undefined && tab.badge > 0 ? (
                  <Box testID={`shared-tab-${tab.key}-badge`} className={getBadgeContainerClassName(tab.badgeVariant)} style={{ minHeight: 18, zIndex: 1 }}>
                    <Text className={getBadgeTextClassName(tab.badgeVariant)} numberOfLines={1}>
                      {tab.badge}
                    </Text>
                  </Box>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          {showOverflowIndicators && overflowState.canScrollLeft ? (
            <Box
              pointerEvents="none"
              testID="shared-tabs-left-overflow"
              className="absolute bottom-0 left-0 top-0 items-center justify-center bg-background-0/95 dark:bg-background-950/95"
              style={styles.overflowIndicator}
            >
              <ChevronLeft size={20} className="text-typography-700 dark:text-typography-200" />
            </Box>
          ) : null}

          {showOverflowIndicators && overflowState.canScrollRight ? (
            <Box
              pointerEvents="none"
              testID="shared-tabs-right-overflow"
              className="absolute bottom-0 right-0 top-0 items-center justify-center bg-background-0/95 dark:bg-background-950/95"
              style={styles.overflowIndicator}
            >
              <ChevronRight size={20} className="text-typography-700 dark:text-typography-200" />
            </Box>
          ) : null}
        </Box>
      ) : (
        <Box className={getContainerStyles()}>
          {tabs.map((tab, index) => (
            <Pressable key={tab.key} className={`flex-1 ${getTabStyles(index)} relative`} onPress={() => handleTabPress(index)}>
              <Box className="flex-row items-center justify-center">
                {tab.icon ? <Box className={isLandscape ? 'mr-1.5' : 'mr-1'}>{tab.icon}</Box> : null}
                {typeof tab.title === 'string' ? (
                  <Text className={isLandscape ? getTextColor() : `text-xs ${getTextColor()}`} numberOfLines={1} style={styles.tabLabel}>
                    {t(tab.title)}
                  </Text>
                ) : (
                  <Text className={isLandscape ? getTextColor() : `text-xs ${getTextColor()}`} numberOfLines={1} style={styles.tabLabel}>
                    {tab.title}
                  </Text>
                )}
              </Box>
              {tab.badge !== undefined && tab.badge > 0 ? (
                <Box testID={`shared-tab-${tab.key}-badge`} className={getBadgeContainerClassName(tab.badgeVariant)} style={{ minHeight: 18, zIndex: 1 }}>
                  <Text className={getBadgeTextClassName(tab.badgeVariant)} numberOfLines={1}>
                    {tab.badge}
                  </Text>
                </Box>
              ) : null}
            </Pressable>
          ))}
        </Box>
      )}

      {/* Tab Content */}
      <Box className={`w-full flex-1 pt-2 ${contentClassName}`}>{tabs[currentIndex]?.content}</Box>
    </Box>
  );
};

const styles = StyleSheet.create({
  overflowIndicator: {
    width: 28,
    zIndex: 2,
  },
  scrollableTab: {
    flexShrink: 0,
  },
  scrollView: {
    width: '100%',
  },
  tabLabel: {
    flexShrink: 0,
  },
});
