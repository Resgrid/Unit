import { ArrowRight } from 'lucide-react-native';
import * as React from 'react';

import { Pressable, View } from '@/components/ui';
import { Text } from '@/components/ui/text';

type ItemProps = {
  text: string;
  value?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  textStyle?: string;
};

export const Item = ({ text, value, icon, onPress, textStyle }: ItemProps) => {
  const isPressable = onPress !== undefined;
  return (
    <Pressable
      onPress={onPress}
      pointerEvents={isPressable ? 'auto' : 'none'}
      className="flex-1 flex-row items-center justify-between px-4 py-2"
    >
      <View className="flex-row items-center">
        {icon && <View className="pr-2">{icon}</View>}
        <Text className={`${textStyle}`}>{text}</Text>
      </View>
      <View className="flex-row items-center">
        <Text className="text-neutral-600 dark:text-white">{value}</Text>
        {isPressable && (
          <View className="pl-2">
            <ArrowRight />
          </View>
        )}
      </View>
    </Pressable>
  );
};
