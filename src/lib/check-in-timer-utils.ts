import { CHECK_IN_TARGET_TYPE, type CheckInEligibilityContext, isCheckInTargetEligible } from '@/lib/check-in-eligibility';

export type CheckInTimerStatus = 'critical' | 'ok' | 'overdue' | 'unknown' | 'warning';
export type CheckInTimerBadgeVariant = 'critical' | 'warning';

interface CheckInTimerTargetStatus {
  Status: string;
  TargetEntityId?: string | number | null;
  TargetType: number;
  UnitTypeId?: string | number | null;
}

export interface CheckInTimerBadge {
  count: number;
  variant: CheckInTimerBadgeVariant;
}

const STATUS_COLORS: Record<CheckInTimerStatus, string> = {
  critical: '#EF4444',
  ok: '#22C55E',
  overdue: '#F59E0B',
  unknown: '#808080',
  warning: '#F59E0B',
};

const STATUS_SEVERITY: Record<CheckInTimerStatus, number> = {
  critical: 0,
  overdue: 1,
  warning: 1,
  ok: 2,
  unknown: 3,
};

export const normalizeCheckInTimerStatus = (status: string | null | undefined): CheckInTimerStatus => {
  switch (status?.trim().toLowerCase()) {
    case 'critical':
    case 'critial':
      return 'critical';
    case 'green':
    case 'ok':
      return 'ok';
    case 'overdue':
      return 'overdue';
    case 'warning':
      return 'warning';
    default:
      return 'unknown';
  }
};

export const getCheckInTimerStatusColor = (status: string | null | undefined): string => STATUS_COLORS[normalizeCheckInTimerStatus(status)];

export const getCheckInTimerStatusSeverity = (status: string | null | undefined): number => STATUS_SEVERITY[normalizeCheckInTimerStatus(status)];

export const getCheckInTimerStatusTranslationKey = (status: string | null | undefined): string | null => {
  switch (normalizeCheckInTimerStatus(status)) {
    case 'critical':
      return 'check_in.status_critical';
    case 'ok':
      return 'check_in.status_ok';
    case 'overdue':
      return 'check_in.status_overdue';
    case 'warning':
      return 'check_in.status_warning';
    default:
      return null;
  }
};

export const isCheckInTimerCritical = (status: string | null | undefined): boolean => {
  return normalizeCheckInTimerStatus(status) === 'critical';
};

export const isCheckInTimerOverdue = (status: string | null | undefined): boolean => {
  const normalizedStatus = normalizeCheckInTimerStatus(status);
  return normalizedStatus === 'overdue' || normalizedStatus === 'warning';
};

export const getUnitTypeCheckInBadge = (timerStatuses: CheckInTimerTargetStatus[], context: CheckInEligibilityContext): CheckInTimerBadge | null => {
  const eligibleUnitTypeTimers = timerStatuses.filter((timer) => timer.TargetType === CHECK_IN_TARGET_TYPE.UNIT_TYPE && isCheckInTargetEligible(timer, context));
  const criticalCount = eligibleUnitTypeTimers.filter((timer) => isCheckInTimerCritical(timer.Status)).length;
  const overdueCount = eligibleUnitTypeTimers.filter((timer) => isCheckInTimerOverdue(timer.Status)).length;
  const missingCheckInCount = criticalCount + overdueCount;

  if (missingCheckInCount === 0) {
    return null;
  }

  return {
    count: missingCheckInCount,
    variant: criticalCount > 0 ? 'critical' : 'warning',
  };
};
