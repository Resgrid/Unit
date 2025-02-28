import React, { useState, useCallback } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Pressable } from '@/components/ui/pressable';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';

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
  onChange?: (index: number) => void;
}

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
  onChange,
}) => {
  const { t } = useTranslation();
  const [localActiveIndex, setLocalActiveIndex] = useState(initialIndex);
  const { activeIndex, setActiveIndex } = useTabStore();

  // Use local state if no external state management is needed
  const currentIndex = onChange ? activeIndex : localActiveIndex;

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

  // Determine tab styles based on variant and size
  const getTabStyles = (index: number) => {
    const isActive = index === currentIndex;

    const baseStyles = 'flex-1 flex items-center justify-center';
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    }[size];

    const variantStyles = {
      default: isActive
        ? 'border-b-2 border-primary-500 text-primary-500'
        : 'border-b-2 border-transparent text-gray-500',
      pills: isActive
        ? 'bg-primary-500 text-white rounded-full'
        : 'bg-transparent text-gray-500',
      underlined: isActive
        ? 'border-b-2 border-primary-500 text-primary-500'
        : 'border-b-2 border-transparent text-gray-500',
      segmented: isActive
        ? 'bg-primary-500 text-white'
        : 'bg-gray-100 text-gray-500',
    }[variant];

    return `${baseStyles} ${sizeStyles} ${variantStyles} ${tabClassName}`;
  };

  // Container styles based on variant
  const getContainerStyles = () => {
    const baseStyles = 'flex flex-row flex-1';

    const variantStyles = {
      default: 'border-b border-gray-200',
      pills: 'space-x-2 p-1',
      underlined: 'border-b border-gray-200',
      segmented: 'bg-gray-100 p-1 rounded-lg',
    }[variant];

    return `${baseStyles} ${variantStyles} ${tabsContainerClassName}`;
  };

  return (
    <Box className={`flex-1 ${className}`}>
      {/* Tab Headers */}
      {scrollable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName={getContainerStyles()}
        >
          {tabs.map((tab, index) => (
            <Pressable
              key={tab.key}
              className={getTabStyles(index)}
              onPress={() => handleTabPress(index)}
            >
              {tab.icon && <Box className="mr-1.5">{tab.icon}</Box>}
              {typeof tab.title === 'string' ? (
                <Text>{t(tab.title)}</Text>
              ) : (
                <Text className="text-gray-800">{tab.title}</Text>
              )}
              {tab.badge !== undefined && tab.badge > 0 && (
                <Box className="ml-1.5 bg-red-500 rounded-full px-1.5 py-0.5 min-w-[20px] items-center">
                  <Text className="text-white text-xs font-bold">
                    {tab.badge}
                  </Text>
                </Box>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Box className={getContainerStyles()}>
          {tabs.map((tab, index) => (
            <Pressable
              key={tab.key}
              className={`flex-1 ${getTabStyles(index)}`}
              onPress={() => handleTabPress(index)}
            >
              {tab.icon && <Box className="mr-1.5">{tab.icon}</Box>}
              {typeof tab.title === 'string' ? (
                <Text className="text-gray-800">{t(tab.title)}</Text>
              ) : (
                <Text className="text-gray-800">{tab.title}</Text>
              )}
              {tab.badge !== undefined && tab.badge > 0 && (
                <Box className="ml-1.5 bg-red-500 rounded-full px-1.5 py-0.5 min-w-[20px] items-center">
                  <Text className="text-white text-xs font-bold">
                    {tab.badge}
                  </Text>
                </Box>
              )}
            </Pressable>
          ))}
        </Box>
      )}

      {/* Tab Content */}
      <Box className={`flex-1 ${contentClassName}`}>
        {tabs[currentIndex]?.content}
      </Box>
    </Box>
  );
};
