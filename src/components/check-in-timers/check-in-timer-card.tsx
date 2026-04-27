import { Timer } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';

const STATUS_COLORS: Record<string, string> = {
  Ok: '#22C55E',
  Warning: '#F59E0B',
  Overdue: '#EF4444',
};

interface CheckInTimerCardProps {
  timer: CheckInTimerStatusResultData;
  onCheckIn: () => void;
  showCheckInButton?: boolean;
}

export const CheckInTimerCard: React.FC<CheckInTimerCardProps> = ({ timer, onCheckIn, showCheckInButton = true }) => {
  const { t } = useTranslation();
  const [localElapsed, setLocalElapsed] = useState(timer.ElapsedMinutes);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Tick locally between polls for smooth countdown
  useEffect(() => {
    setLocalElapsed(timer.ElapsedMinutes);
  }, [timer.ElapsedMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalElapsed((prev) => prev + 1 / 60);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Pulse animation for overdue
  useEffect(() => {
    if (timer.Status === 'Overdue') {
      const animation = Animated.loop(
        Animated.sequence([Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timer.Status, pulseAnim]);

  const statusColor = STATUS_COLORS[timer.Status] ?? '#808080';
  const progress = Math.min(localElapsed / timer.DurationMinutes, 1);
  const minutesAgo = Math.floor(localElapsed);

  return (
    <Box className="mb-2 rounded-xl border border-outline-100 p-3">
      <HStack className="items-center justify-between">
        <HStack className="flex-1 items-center" space="sm">
          <Animated.View style={{ opacity: pulseAnim }}>
            <Timer size={20} color={statusColor} />
          </Animated.View>
          <VStack className="flex-1">
            <Text className="font-semibold">{timer.TargetName}</Text>
            <Text className="text-xs text-gray-500">{timer.TargetTypeName}</Text>
          </VStack>
        </HStack>
        <Box className="rounded-full px-2 py-1" style={{ backgroundColor: statusColor + '20' }}>
          <Text className="text-xs font-medium" style={{ color: statusColor }}>
            {t(`check_in.status_${timer.Status.toLowerCase()}`)}
          </Text>
        </Box>
      </HStack>

      {/* Progress bar */}
      <Box className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
        <Box className="h-full rounded-full" style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: statusColor }]} />
      </Box>

      <HStack className="mt-1 items-center justify-between">
        <Text className="text-xs text-gray-500">
          {t('check_in.last_check_in')}: {minutesAgo} {t('check_in.minutes_ago')}
        </Text>
        <Text className="text-xs text-gray-500">
          {Math.floor(localElapsed)}/{timer.DurationMinutes} {t('check_in.duration')}
        </Text>
      </HStack>

      {showCheckInButton ? (
        <Button variant="solid" size="sm" onPress={onCheckIn} className="mt-2" style={{ backgroundColor: statusColor }}>
          <ButtonText className="text-white">{t('check_in.perform_check_in')}</ButtonText>
        </Button>
      ) : null}
    </Box>
  );
};

const styles = StyleSheet.create({
  progressBar: {
    minWidth: 4,
  },
});
