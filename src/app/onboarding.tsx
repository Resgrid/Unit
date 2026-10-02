import { useRouter } from 'expo-router';
import { Bell, MapPin, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useAuthStore } from '@/lib/auth';
import { useIsFirstTime } from '@/lib/storage';

const SLIDES = [
  {
    titleKey: 'onboarding.unitTitle',
    title: 'Resgrid Unit',
    descriptionKey: 'onboarding.unitDescription',
    description: "Track your unit's location and status in real-time with our advanced mapping and AVL system",
    icon: <MapPin size={56} color="#FF7B1A" />,
  },
  {
    titleKey: 'onboarding.notificationsTitle',
    title: 'Instant Notifications',
    descriptionKey: 'onboarding.notificationsDescription',
    description: 'Receive immediate alerts for emergencies and important updates from your department',
    icon: <Bell size={56} color="#FF7B1A" />,
  },
  {
    titleKey: 'onboarding.callsTitle',
    title: 'Interact with Calls',
    descriptionKey: 'onboarding.callsDescription',
    description: 'Seamlessly view call information and interact with your team members for efficient emergency response',
    icon: <Users size={56} color="#FF7B1A" />,
  },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const [, setIsFirstTime] = useIsFirstTime();
  const setIsOnboarding = useAuthStore((state) => state.setIsOnboarding);
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setIsOnboarding();
  }, [setIsOnboarding]);

  const finish = useCallback(() => {
    setIsFirstTime(false);
    router.replace('/login');
  }, [setIsFirstTime, router]);

  const slide = SLIDES[currentIndex];
  return (
    <OnboardingScreen
      title={t(slide.titleKey, { defaultValue: slide.title })}
      description={t(slide.descriptionKey, { defaultValue: slide.description })}
      icon={slide.icon}
      currentIndex={currentIndex}
      total={SLIDES.length}
      skipLabel={t('onboarding.skip', { defaultValue: 'Skip' })}
      nextLabel={t('onboarding.next', { defaultValue: 'Next' })}
      finishLabel={t('onboarding.getStarted', { defaultValue: "Let's Get Started" })}
      onSkip={finish}
      onFinish={finish}
      onNext={() => setCurrentIndex((index) => Math.min(index + 1, SLIDES.length - 1))}
      onSlideChange={setCurrentIndex}
    />
  );
}
