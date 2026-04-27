import { BaseV4Request } from '../baseV4Request';
import { WeatherAlertSettingsData } from './weatherAlertSettingsData';

export class WeatherAlertSettingsResult extends BaseV4Request {
  public Data: WeatherAlertSettingsData = new WeatherAlertSettingsData();
}
