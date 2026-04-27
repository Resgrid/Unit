export class WeatherAlertSettingsData {
  public WeatherAlertsEnabled: boolean = false;
  public MinimumSeverity: number = 4;
  public AutoMessageSeverity: number = 0;
  public CallIntegrationEnabled: boolean = false;
  public AutoMessageSchedule: string[] = [];
  public ExcludedEvents: string = '';
}
