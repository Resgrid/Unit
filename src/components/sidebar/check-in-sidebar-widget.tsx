import { useRouter } from 'expo-router';
import { Timer } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useQuickCheckIn } from '@/hooks/use-quick-check-in';
import { useCoreStore } from '@/stores/app/core-store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';

const STATUS_COLORS: Record<string, string> = {
  Ok: '#22C55E',
  Warning: '#F59E0B',
  Overdue: '#EF4444',
};

export const CheckInSidebarWidget: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const activeCall = useCoreStore((state) => state.activeCall);
  const timerStatuses = useCheckInTimerStore((state) => state.timerStatuses);

  const callId = activeCall ? parseInt(activeCall.CallId, 10) : 0;
  const { quickCheckIn, isCheckingIn } = useQuickCheckIn(callId);

  // Only render when there's an active call with timers
  if (!activeCall?.CheckInTimersEnabled || timerStatuses.length === 0) {
    return null;
  }

  // Get most urgent timer
  const urgentTimer = timerStatuses[0];
  const statusColor = STATUS_COLORS[urgentTimer.Status] ?? '#808080';

  const handleNavigateToCheckIn = () => {
    router.push(`/call/${activeCall.CallId}`);
  };

  return (
    <Pressable onPress={handleNavigateToCheckIn}>
      <Box className="rounded-xl border border-outline-100 p-2">
        <HStack className="items-center justify-between">
          <HStack className="flex-1 items-center" space="sm">
            <Box className="size-3 rounded-full" style={{ backgroundColor: statusColor }} />
            <VStack className="flex-1">
              <Text className="text-xs font-semibold" numberOfLines={1}>
                {urgentTimer.TargetName}
              </Text>
              <HStack className="items-center" space="xs">
                <Timer size={12} color={statusColor} />
                <Text className="text-xs" style={{ color: statusColor }}>
                  {Math.floor(urgentTimer.ElapsedMinutes)}/{urgentTimer.DurationMinutes} {t('check_in.duration')}
                </Text>
              </HStack>
            </VStack>
          </HStack>
          <Button variant="solid" size="xs" onPress={quickCheckIn} disabled={isCheckingIn} style={{ backgroundColor: statusColor }}>
            <ButtonText className="text-xs text-white">{t('check_in.quick_check_in')}</ButtonText>
          </Button>
        </HStack>
      </Box>
    </Pressable>
  );
};
