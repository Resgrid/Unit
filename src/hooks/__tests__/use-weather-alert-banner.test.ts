import { act, renderHook } from '@testing-library/react-native';

import { useWeatherAlertBanner } from '@/hooks/use-weather-alert-banner';
import { WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

const createMockAlert = (weatherAlertId: string): WeatherAlertResultData => {
  return Object.assign(new WeatherAlertResultData(), { WeatherAlertId: weatherAlertId });
};

describe('useWeatherAlertBanner', () => {
  it('keeps dismissed alerts hidden and reveals only newly received alert IDs', () => {
    const firstAlert = createMockAlert('alert-1');
    const secondAlert = createMockAlert('alert-2');
    const newAlert = createMockAlert('alert-3');
    const { result, rerender, unmount } = renderHook(({ alerts }) => useWeatherAlertBanner(alerts), {
      initialProps: { alerts: [firstAlert, secondAlert] },
    });

    expect(result.current.bannerAlerts.map((alert) => alert.WeatherAlertId)).toEqual(['alert-1', 'alert-2']);

    act(() => {
      result.current.dismissBanner();
    });

    expect(result.current.bannerAlerts).toEqual([]);

    rerender({ alerts: [secondAlert, newAlert] });

    expect(result.current.bannerAlerts.map((alert) => alert.WeatherAlertId)).toEqual(['alert-3']);
    unmount();
  });

  it('does not reveal a dismissed alert when that alert is updated', () => {
    const firstAlert = createMockAlert('alert-1');
    const { result, rerender, unmount } = renderHook(({ alerts }) => useWeatherAlertBanner(alerts), {
      initialProps: { alerts: [firstAlert] },
    });

    act(() => {
      result.current.dismissBanner();
    });

    rerender({ alerts: [Object.assign(new WeatherAlertResultData(), firstAlert, { Headline: 'Updated headline' })] });

    expect(result.current.bannerAlerts).toEqual([]);
    unmount();
  });
});
