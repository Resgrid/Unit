import { useRouter } from 'expo-router';
import { Bell, ChevronRight, MapPin, Users } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/auth';
import { useIsFirstTime } from '@/lib/storage';

type OnboardingItemProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const SLIDES = [
  {
    title: 'Resgrid Unit',
    description: "Track your unit's location and status in real-time with our advanced mapping and AVL system",
    icon: <MapPin size={80} color="#FF7B1A" />,
  },
  {
    title: 'Instant Notifications',
    description: 'Receive immediate alerts for emergencies and important updates from your department',
    icon: <Bell size={80} color="#FF7B1A" />,
  },
  {
    title: 'Interact with Calls',
    description: 'Seamlessly view call information and interact with your team members for efficient emergency response',
    icon: <Users size={80} color="#FF7B1A" />,
  },
];

const SLIDE_COUNT = SLIDES.length;
const SPRING_CONFIG = { damping: 25, stiffness: 200 };

const OnboardingSlide: React.FC<OnboardingItemProps & { slideWidth: number }> = ({ title, description, icon, slideWidth }) => (
  <View className="items-center justify-center px-8" style={{ width: slideWidth }}>
    <View className="mb-8 items-center justify-center">{icon}</View>
    <Text className="mb-6 text-center text-3xl font-bold text-gray-900 dark:text-white">{title}</Text>
    <Text className="text-center text-lg leading-6 text-gray-600 dark:text-gray-300" style={{ paddingHorizontal: 20 }}>
      {description}
    </Text>
  </View>
);

const Pagination: React.FC<{ currentIndex: number; length: number }> = ({ currentIndex, length }) => (
  <View className="mt-8 flex-row justify-center">
    {Array.from({ length }).map((_, index) => (
      <View key={index} className={`mx-1 h-2.5 rounded-full ${currentIndex === index ? 'w-6 bg-primary-500' : 'w-2.5 bg-primary-300'}`} />
    ))}
  </View>
);

export default function Onboarding() {
  const [_, setIsFirstTime] = useIsFirstTime();
  const setIsOnboarding = useAuthStore((state) => state.setIsOnboarding);
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidthState, setContainerWidthState] = useState(0);
  const containerWidth = useSharedValue(0);
  const { colorScheme } = useColorScheme();

  // Shared value tracks slide position as an index offset (e.g. 0 = first slide, 1 = second)
  const slideOffset = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const startOffset = useSharedValue(0);

  useEffect(() => {
    setIsOnboarding();
  }, [setIsOnboarding]);

  const updateIndex = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      buttonOpacity.value = index === SLIDE_COUNT - 1 ? withTiming(1, { duration: 500 }) : withTiming(0, { duration: 300 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Sync shared value → JS state whenever the slide settles
  useAnimatedReaction(
    () => Math.round(slideOffset.value),
    (result, previous) => {
      if (result !== previous && result >= 0 && result < SLIDE_COUNT) {
        runOnJS(updateIndex)(result);
      }
    }
  );

  // Swipe gesture: pan horizontally, snap to nearest slide on release
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onStart(() => {
      'worklet';
      startOffset.value = slideOffset.value;
    })
    .onUpdate((event) => {
      'worklet';
      const dragIndex = -event.translationX / containerWidth.value;
      const target = startOffset.value + dragIndex;
      slideOffset.value = Math.max(-0.3, Math.min(SLIDE_COUNT - 1 + 0.3, target));
    })
    .onEnd(() => {
      'worklet';
      const snapped = Math.round(slideOffset.value);
      const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, snapped));
      slideOffset.value = withSpring(clamped, SPRING_CONFIG);
    });

  const nextSlide = useCallback(() => {
    const next = Math.min(currentIndex + 1, SLIDE_COUNT - 1);
    slideOffset.value = withSpring(next, SPRING_CONFIG);
  }, [currentIndex, slideOffset]);

  const skip = useCallback(() => {
    setIsFirstTime(false);
    router.replace('/login');
  }, [setIsFirstTime, router]);

  const finish = useCallback(() => {
    setIsFirstTime(false);
    router.replace('/login');
  }, [setIsFirstTime, router]);

  const handleContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const w = event.nativeEvent.layout.width;
      containerWidth.value = w;
      setContainerWidthState(w);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // The entire carousel translates on X
  const carouselStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -slideOffset.value * containerWidth.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: (1 - buttonOpacity.value) * 20 }],
  }));

  if (containerWidthState === 0) {
    // Render only the outer container to measure width before laying out slides
    return (
      <View className="flex-1" onLayout={handleContainerLayout}>
        <FocusAwareStatusBar hidden={true} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FocusAwareStatusBar hidden={true} />

      <View className="w-full items-center justify-center px-10 pt-20">
        <Image style={{ width: '96%' }} resizeMode="contain" source={colorScheme === 'dark' ? require('@assets/images/Resgrid_JustText_White.png') : require('@assets/images/Resgrid_JustText.png')} />
      </View>

      <View className="flex-1 justify-center" onLayout={handleContainerLayout}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[carouselStyle, { flexDirection: 'row', width: containerWidthState * SLIDE_COUNT }]}>
            {SLIDES.map((slide) => (
              <OnboardingSlide key={slide.title} {...slide} slideWidth={containerWidthState} />
            ))}
          </Animated.View>
        </GestureDetector>
      </View>

      <Pagination currentIndex={currentIndex} length={SLIDE_COUNT} />

      <SafeAreaView className="mb-8 mt-4 px-8">
        {currentIndex < SLIDE_COUNT - 1 ? (
          <View className="flex-row items-center justify-between">
            <Pressable onPress={skip}>
              <Text className="text-gray-500">Skip</Text>
            </Pressable>

            <Pressable className="flex-row items-center rounded-lg bg-primary-500 px-6 py-3" onPress={nextSlide}>
              <Text className="mr-1 text-base font-semibold text-white dark:text-black">Next</Text>
              <ChevronRight size={20} color={colorScheme === 'dark' ? 'black' : 'white'} />
            </Pressable>
          </View>
        ) : (
          <Animated.View style={buttonAnimatedStyle}>
            <Pressable className="w-full items-center rounded-lg bg-primary-500 py-3" onPress={finish}>
              <Text className="text-base font-semibold text-white dark:text-black">Let's Get Started</Text>
            </Pressable>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}
