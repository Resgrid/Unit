import { useRouter } from 'expo-router';
import React from 'react';

import { FocusAwareStatusBar, SafeAreaView, View } from '@/components/ui';
import { Button, ButtonText } from '@/components/ui/button';
import { Cover } from '@/components/ui/cover';
import { Text } from '@/components/ui/text';
import { useIsFirstTime } from '@/lib/storage';

export default function Onboarding() {
  const [_, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();
  return (
    <View className="flex h-full items-center  justify-center">
      <FocusAwareStatusBar />
      <View className="w-full flex-1">
        <Cover />
      </View>
      <View className="justify-end ">
        <Text className="my-3 text-center text-5xl font-bold">
          Obytes Starter
        </Text>
        <Text className="mb-2 text-center text-lg text-gray-600">
          The right way to build your mobile app
        </Text>

        <Text className="my-1 pt-6 text-left text-lg">
          🚀 Production-ready{' '}
        </Text>
        <Text className="my-1 text-left text-lg">
          🥷 Developer experience + Productivity
        </Text>
        <Text className="my-1 text-left text-lg">
          🧩 Minimal code and dependencies
        </Text>
        <Text className="my-1 text-left text-lg">
          💪 well maintained third-party libraries
        </Text>
      </View>
      <SafeAreaView className="mt-6">
        <Button
          size="lg"
          variant="solid"
          action="primary"
          className="bg-primary-500"
          onPress={() => {
            setIsFirstTime(false);
            router.replace('/login');
          }}
        >
          <ButtonText>Let's Get Started </ButtonText>
        </Button>
      </SafeAreaView>
    </View>
  );
}
