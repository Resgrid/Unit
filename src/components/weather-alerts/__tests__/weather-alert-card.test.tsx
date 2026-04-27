import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { WeatherAlertCard } from '../weather-alert-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/utils', () => ({
  getTimeAgoUtc: jest.fn(() => '2h ago'),
}));

jest.mock('@/lib/weather-alert-utils', () => ({
  getSeverityColor: jest.fn(() => '#D32F2F'),
  getSeverityTranslationKey: jest.fn(() => 'weather_alerts.severity.severe'),
  getCategoryIcon: jest.fn(() => {
    const { View } = require('react-native');
    return (props: any) => <View testID="category-icon" {...props} />;
  }),
}));

const createMockAlert = (overrides = {}) => ({
  WeatherAlertId: 'alert-1',
  DepartmentId: 1,
  Event: 'Tornado Warning',
  Headline: 'Tornado Warning for County',
  Description: 'A tornado has been spotted.',
  Instructions: 'Take shelter.',
  Severity: 1,
  Category: 0,
  Urgency: 0,
  Certainty: 0,
  Status: 0,
  SourceType: 0,
  SourceAlertId: '',
  SenderName: 'NWS',
  AreaDescription: 'County A',
  Polygon: '',
  CenterGeoLocation: '',
  EffectiveUtc: '2026-04-15T10:00:00Z',
  OnsetUtc: '',
  ExpiresUtc: '2026-04-15T14:00:00Z',
  Ends: '',
  ReceivedOnUtc: '',
  UpdatedOnUtc: '',
  WebUrl: '',
  ZoneCode: '',
  MessageType: '',
  ...overrides,
});

describe('WeatherAlertCard', () => {
  it('should render alert event name', () => {
    render(<WeatherAlertCard alert={createMockAlert()} />);
    expect(screen.getByText('Tornado Warning')).toBeTruthy();
  });

  it('should render headline', () => {
    render(<WeatherAlertCard alert={createMockAlert()} />);
    expect(screen.getByText('Tornado Warning for County')).toBeTruthy();
  });

  it('should render area description', () => {
    render(<WeatherAlertCard alert={createMockAlert()} />);
    expect(screen.getByText('County A')).toBeTruthy();
  });

  it('should render severity badge', () => {
    render(<WeatherAlertCard alert={createMockAlert()} />);
    expect(screen.getByText('weather_alerts.severity.severe')).toBeTruthy();
  });

  it('should render without headline when empty', () => {
    render(<WeatherAlertCard alert={createMockAlert({ Headline: '' })} />);
    expect(screen.getByText('Tornado Warning')).toBeTruthy();
  });
});
