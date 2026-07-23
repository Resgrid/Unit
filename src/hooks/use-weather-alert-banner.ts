import { useCallback, useMemo, useState } from 'react';

import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

interface UseWeatherAlertBannerResult {
  bannerAlerts: WeatherAlertResultData[];
  dismissBanner: () => void;
}

export const useWeatherAlertBanner = (alerts: WeatherAlertResultData[]): UseWeatherAlertBannerResult => {
  const [dismissedAlertIds, setDismissedAlertIds] = useState<ReadonlySet<string>>(() => new Set());

  const bannerAlerts = useMemo(() => alerts.filter((alert) => !dismissedAlertIds.has(alert.WeatherAlertId)), [alerts, dismissedAlertIds]);

  const dismissBanner = useCallback(() => {
    if (bannerAlerts.length === 0) return;

    setDismissedAlertIds((currentIds) => {
      const nextIds = new Set(currentIds);
      let hasChanges = false;

      for (const alert of bannerAlerts) {
        if (!nextIds.has(alert.WeatherAlertId)) {
          nextIds.add(alert.WeatherAlertId);
          hasChanges = true;
        }
      }

      return hasChanges ? nextIds : currentIds;
    });
  }, [bannerAlerts]);

  return { bannerAlerts, dismissBanner };
};
