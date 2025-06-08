import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export const ThemeToggle: React.FC = () => {
  const { themeType, setThemeType, isDark } = useTheme();
  
  return (
    <View className="flex-row items-center space-x-4 p-4">
      <Text className={isDark ? 'text-neutral-200' : 'text-neutral-700'}>Theme:</Text>
      
      <View className="flex-row bg-neutral-200 dark:bg-neutral-700 rounded-lg overflow-hidden">
        <TouchableOpacity
          onPress={() => setThemeType('light')}
          className={`px-3 py-2 ${themeType === 'light' ? 
            (isDark ? 'bg-neutral-600' : 'bg-white') : 'bg-transparent'}`}
        >
          <Text className={isDark ? 'text-neutral-200' : 'text-neutral-700'}>Light</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setThemeType('dark')}
          className={`px-3 py-2 ${themeType === 'dark' ? 
            (isDark ? 'bg-neutral-600' : 'bg-white') : 'bg-transparent'}`}
        >
          <Text className={isDark ? 'text-neutral-200' : 'text-neutral-700'}>Dark</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setThemeType('system')}
          className={`px-3 py-2 ${themeType === 'system' ? 
            (isDark ? 'bg-neutral-600' : 'bg-white') : 'bg-transparent'}`}
        >
          <Text className={isDark ? 'text-neutral-200' : 'text-neutral-700'}>System</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}; 