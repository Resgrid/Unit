import { Link, Stack } from 'expo-router';
import React from 'react';

import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-2xl font-bold">This screen doesn't exist.</Text>

        <Link href="/" className="mt-4">
          <Text className="text-blue-500 underline">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
