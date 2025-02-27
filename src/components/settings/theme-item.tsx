import React from 'react';
import type { ColorSchemeType } from '@/lib';
import { translate, useSelectedTheme } from '@/lib';

import { Item } from './item';
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from '../ui/select';
import { ChevronDownIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from '../ui/view';
import { Text } from '../ui/text';
export const ThemeItem = () => {
  const { selectedTheme, setSelectedTheme } = useSelectedTheme();
  const { t } = useTranslation();

  const onSelect = React.useCallback(
    (option: string) => {
      setSelectedTheme(option as ColorSchemeType);
    },
    [setSelectedTheme]
  );

  const themes = React.useMemo(
    () => [
      { label: `${translate('settings.theme.dark')} 🌙`, value: 'dark' },
      { label: `${translate('settings.theme.light')} 🌞`, value: 'light' },
      { label: `${translate('settings.theme.system')} ⚙️`, value: 'system' },
    ],
    []
  );

  const theme = React.useMemo(
    () => themes.find((t) => t.value === selectedTheme),
    [selectedTheme, themes]
  );

  return (
    <View className="flex-1 flex-row items-center justify-between px-4 py-2">
      <View className="flex-row items-center">
        <Text>{t('settings.theme.title')}</Text>
      </View>
      <View className="flex-row items-center">
        <Select onValueChange={onSelect} selectedValue={theme?.value}>
          <SelectTrigger>
            <SelectInput placeholder="Select option" className="w-[240px]" />
            <SelectIcon as={ChevronDownIcon} className="mr-3" />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              {themes.map((theme) => (
                <SelectItem
                  key={theme.value}
                  label={theme.label}
                  value={theme.value}
                />
              ))}
            </SelectContent>
          </SelectPortal>
        </Select>
      </View>
    </View>
  );
};
