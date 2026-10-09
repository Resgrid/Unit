jest.mock('@/components/common/native-modal', () => ({ NativeModal: require('react-native').Modal }));
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { TimeReportEditor } from '@/components/operations/time-report-editor';
import { newEntry } from '@/lib/operations/time';
import { type TimeReport, TimeReportScope, TimeReportStatus, TimeSubjectType } from '@/models/v4/operations';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { number?: string }) => (options?.number ? `${key} ${options.number}` : key) }) }));
jest.mock('@/components/operations/option-select', () => ({ OptionSelect: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

const subject = { type: TimeSubjectType.Personnel, id: 'person-1', label: 'Crew member' };
const props = () => ({
  dateKey: '2026-09-26',
  report: { CanAct: true, Status: TimeReportStatus.Draft } as TimeReport,
  entries: [newEntry(subject, '2026-09-26', 0, { StartLocal: '2026-09-26T22:00:00', EndLocal: '2026-09-26T23:00:00' })],
  subjects: [subject],
  names: { 'person-1': 'Crew member' },
  scopeLabel: 'Crew member',
  isCrew: false,
  coveredBy: null,
  issues: [],
  warnings: [],
  canCreate: true,
  canApprove: false,
  canWrite: () => true,
  dirty: false,
  busy: false,
  onStart: jest.fn(),
  onChange: jest.fn(),
  onSave: jest.fn(),
  onSubmit: jest.fn(),
  onSign: jest.fn(),
  onApprove: jest.fn(),
});

it('keeps overnight end times on the next day after picking a clock time', () => {
  const options = props();
  const screen = render(<TimeReportEditor {...options} />);
  fireEvent.press(screen.getByTestId('operations-entry-end-0'));
  fireEvent.press(screen.getByTestId('operations-entry-end-0-hour-2'));
  fireEvent.press(screen.getByTestId('operations-entry-end-0-minute-30'));
  fireEvent.press(screen.getByTestId('operations-entry-end-0-done'));
  expect(options.onChange).toHaveBeenCalledWith([expect.objectContaining({ StartLocal: '2026-09-26T22:00:00', EndLocal: '2026-09-27T02:30' })]);
  screen.unmount();
});

it('does not allow time edits on a submitted report', () => {
  const options = props();
  options.report.Status = TimeReportStatus.Submitted;
  const screen = render(<TimeReportEditor {...options} />);
  fireEvent.press(screen.getByTestId('operations-entry-start-0'));
  expect(screen.queryByTestId('operations-entry-start-0-done')).toBeNull();
  expect(options.onChange).not.toHaveBeenCalled();
  screen.unmount();
});

it('shows an issued report number without a # prefix', () => {
  const options = props();
  options.report = { ...options.report, Scope: TimeReportScope.Crew, ReportNumber: 3, DisplayNumber: 'CTR-2026-0003' };
  const screen = render(<TimeReportEditor {...options} />);
  expect(screen.getByText('operations.time.crewReport CTR-2026-0003')).toBeTruthy();
  screen.unmount();
});

it('labels a digit-only report number with #', () => {
  const options = props();
  options.report = { ...options.report, Scope: TimeReportScope.Individual, ReportNumber: 7 };
  const screen = render(<TimeReportEditor {...options} />);
  expect(screen.getByText('operations.time.individualReport #7')).toBeTruthy();
  screen.unmount();
});

it('labels the covering report number the same way', () => {
  const options = { ...props(), report: null, coveredBy: { ReportNumber: 4, DisplayNumber: 'DTR-2026-0004' } as TimeReport };
  const screen = render(<TimeReportEditor {...options} />);
  expect(screen.getByText('operations.time.coveredBy DTR-2026-0004')).toBeTruthy();
  screen.unmount();
});
