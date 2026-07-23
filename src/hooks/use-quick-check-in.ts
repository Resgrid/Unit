import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { PerformCheckInInput } from '@/api/check-in-timers/check-in-timers';
import { CHECK_IN_TARGET_TYPE } from '@/lib/check-in-eligibility';
import { useCoreStore } from '@/stores/app/core-store';
import { useLocationStore } from '@/stores/app/location-store';
import type { CheckInResult } from '@/stores/check-in-timers/store';
import { useCheckInTimerStore } from '@/stores/check-in-timers/store';
import { useToastStore } from '@/stores/toast/store';

export function useQuickCheckIn(callId: number, checkInType?: number) {
  const { t } = useTranslation();
  const isCheckingIn = useCheckInTimerStore((state) => state.isCheckingIn);
  const performCheckInAction = useCheckInTimerStore((state) => state.performCheckIn);
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const showToast = useToastStore((state) => state.showToast);

  const quickCheckIn = useCallback(async () => {
    const resolvedCheckInType = checkInType ?? (activeUnit ? CHECK_IN_TARGET_TYPE.UNIT_TYPE : CHECK_IN_TARGET_TYPE.PERSONNEL);
    const shouldUseActiveUnit = resolvedCheckInType === CHECK_IN_TARGET_TYPE.UNIT_TYPE && activeUnit !== null;
    const input: PerformCheckInInput = {
      CallId: callId,
      CheckInType: resolvedCheckInType,
      UnitId: shouldUseActiveUnit ? parseInt(activeUnit.UnitId, 10) : undefined,
      Latitude: latitude?.toString(),
      Longitude: longitude?.toString(),
    };

    const result: CheckInResult = await performCheckInAction(input);

    if (result === 'success') {
      showToast('success', t('check_in.check_in_success'));
    } else if (result === 'queued') {
      showToast('info', t('check_in.queued_offline'));
    } else {
      showToast('error', t('check_in.check_in_error'));
    }

    return result;
  }, [callId, checkInType, activeUnit, latitude, longitude, performCheckInAction, showToast, t]);

  return { quickCheckIn, isCheckingIn };
}
