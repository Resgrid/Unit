import {
  getCheckInTimerStatusColor,
  getCheckInTimerStatusSeverity,
  getCheckInTimerStatusTranslationKey,
  getUnitTypeCheckInBadge,
  isCheckInTimerCritical,
  isCheckInTimerOverdue,
  normalizeCheckInTimerStatus,
} from '@/lib/check-in-timer-utils';

describe('check-in timer utils', () => {
  it.each([
    ['Green', 'ok'],
    ['Ok', 'ok'],
    ['Warning', 'warning'],
    ['Critical', 'critical'],
    ['Critial', 'critical'],
    ['Overdue', 'overdue'],
    ['unexpected', 'unknown'],
  ])('normalizes %s to %s', (status, expected) => {
    expect(normalizeCheckInTimerStatus(status)).toBe(expected);
  });

  it.each(['Critical', 'Critial'])('treats %s as critical', (status) => {
    expect(isCheckInTimerCritical(status)).toBe(true);
    expect(getCheckInTimerStatusColor(status)).toBe('#EF4444');
    expect(getCheckInTimerStatusSeverity(status)).toBe(0);
  });

  it.each(['Overdue', 'Warning'])('treats %s as overdue/warning', (status) => {
    expect(isCheckInTimerOverdue(status)).toBe(true);
    expect(isCheckInTimerCritical(status)).toBe(false);
    expect(getCheckInTimerStatusColor(status)).toBe('#F59E0B');
    expect(getCheckInTimerStatusSeverity(status)).toBe(1);
  });

  it('maps API status values to stable translation keys', () => {
    expect(getCheckInTimerStatusTranslationKey('Green')).toBe('check_in.status_ok');
    expect(getCheckInTimerStatusTranslationKey('Warning')).toBe('check_in.status_warning');
    expect(getCheckInTimerStatusTranslationKey('Critical')).toBe('check_in.status_critical');
    expect(getCheckInTimerStatusTranslationKey('Critial')).toBe('check_in.status_critical');
    expect(getCheckInTimerStatusTranslationKey('Overdue')).toBe('check_in.status_overdue');
    expect(getCheckInTimerStatusTranslationKey('unexpected')).toBeNull();
  });

  it('returns a warning badge for an overdue matching UnitType timer', () => {
    expect(
      getUnitTypeCheckInBadge([{ TargetType: 1, TargetEntityId: '10', Status: 'Overdue' }], {
        currentUnitTypeId: 10,
        hasCurrentUser: true,
      })
    ).toEqual({ count: 1, variant: 'warning' });
  });

  it('returns a critical badge when any matching UnitType timer is critical', () => {
    expect(
      getUnitTypeCheckInBadge(
        [
          { TargetType: 1, TargetEntityId: '10', Status: 'Overdue' },
          { TargetType: 1, TargetEntityId: '10', Status: 'Critial' },
        ],
        {
          currentUnitTypeId: 10,
          hasCurrentUser: true,
        }
      )
    ).toEqual({ count: 2, variant: 'critical' });
  });

  it('ignores mismatched UnitType, Personnel, and IC timers for the badge', () => {
    expect(
      getUnitTypeCheckInBadge(
        [
          { TargetType: 1, TargetEntityId: '11', Status: 'Critical' },
          { TargetType: 0, TargetEntityId: '', Status: 'Critical' },
          { TargetType: 2, TargetEntityId: '', Status: 'Critical' },
        ],
        {
          currentUnitTypeId: 10,
          hasCurrentUser: true,
        }
      )
    ).toBeNull();
  });
});
