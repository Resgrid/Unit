import { Injectable } from '@angular/core';
import { UtilsService } from '@resgrid/ngx-resgridlib';
import { StartupData } from '../features/settings/models/startupData';
import { LoginResult } from '../models/loginResult';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class StorageProvider {
  constructor(private utilsService: UtilsService) {}

  async init() {
    //await Storage.create();
    await this.initDeviceId();
  }

  private async set(key: string, value: string): Promise<any> {
    return await Preferences?.set({
      key: key,
      value: value,
    });
  }

  private async get(key: string): Promise<any> {
    const { value } = await Preferences?.get({ key: key });

    return value;
  }

  public async clear(): Promise<any> {
    return await Preferences?.clear();
  }

  private async initDeviceId(): Promise<void> {
    const deviceId = await this.get('RGUnitDeviceId');

    if (!deviceId) {
      const newDeviceId = this.utilsService.generateUUID();
      await this.set('RGUnitDeviceId', newDeviceId);
    }
  }

  // Server Address needs to be handled differently because it's used before the app is initialized
  public getServerAddress(): string { //Promise<string> {
    //return await this.get('serverAddress');
    return localStorage.getItem(`RgUnitApp.serverAddress`);
  }

  // Server Address needs to be handled differently because it's used before the app is initialized
  public setServerAddress(serverAddress: string): void { //Promise<any> {
    localStorage.setItem(`RgUnitApp.serverAddress`, serverAddress);
    //return await this.set('serverAddress', serverAddress);
  }

  public async getDeviceId(): Promise<string> {
    return await this.get('RGUnitDeviceId');
  }

  public async setLoginData(loginData: LoginResult): Promise<any> {
    await this.set('RGUnitLoginData', JSON.stringify(loginData));

    return loginData
  }

  public async getLoginData(): Promise<LoginResult> {
    return JSON.parse(await this.get('RGUnitLoginData'));
  }


  public async setEnablePushNotifications(enablePush: boolean): Promise<any> {
    return await this.set('RGUnitEnablePush', enablePush?.toString());
  }

  public async setEnableBackgroundGeolocation(enableBackgroundGeolocation: boolean): Promise<any> {
    return await this.set('RGUnitEnableBackgroundGeo', enableBackgroundGeolocation?.toString());
  }

  public async getEnableBackgroundGeolocation(): Promise<boolean> {
    let data = await this.get('RGUnitEnableBackgroundGeo');
    if (data) {
      let isSet = (data === 'true');
      return isSet;
    }

    return true;
  }

  public async setActiveCall(callId: string): Promise<any> {
    return await this.set('activeCall', callId);
  }

  public async getActiveCall(): Promise<any> {
    return await this.get('activeCall');
  }

  public async getActiveUnit(): Promise<any> {
    return await this.get('activeUnit');
  }

  public async setActiveUnit(unitId: string): Promise<any> {
    return await this.set('activeUnit', unitId);
  }

  public async getEnablePushNotifications(): Promise<boolean> {
    let data = await this.get('RGUnitEnablePush');
    if (data) {
      let isSet = (data === 'true');
      return isSet;
    }

    return true;
  }

  public setThemePreference(perferDark: number): Promise<any> {
    if (typeof(perferDark) === 'undefined') {
      perferDark = -1;
    }

    return this.set('RGUnitThemePref', perferDark.toString());
  }

  public setKeepAlive(keepAlive: boolean): Promise<any> {
    return this.set('RGUnitKeepAlive', keepAlive?.toString());
  }

  public setShowAll(showAll: boolean): Promise<any> {
    return this.set('RGUnitShowAll', showAll?.toString());
  }

  public setHeadsetType(headsetType: number): Promise<any> {
    return this.set('RGUnitHeadsetType', headsetType?.toString());
  }

  public setSelectedMic(mic: string): Promise<any> {
    return this.set('RGUnitSelectedMic', mic);
  }

  public async getSelectedMic(): Promise<string> {
    let data = await this.get('RGUnitSelectedMic');
    if (data) {
      return data;
    }

    return '';
  }

  public async getThemePreference(): Promise<number> {
    let data = await this.get('RGUnitThemePref');
    if (data) {
      return parseInt(data);
    }

    return -1;
  }

  public async getKeepAlive(): Promise<boolean> {
    let data = await this.get('RGUnitKeepAlive');
    if (data) {
      let isSet = (data === 'true');
      return isSet;
    }

    return false;
  }

  public async getShowAll(): Promise<boolean> {
    let data = await this.get('RGUnitShowAll');
    if (data) {
      let isSet = (data === 'true');
      return isSet;
    }

    return false;
  }

  public async getHeadsetType(): Promise<number> {
    let data = await this.get('RGUnitHeadsetType');
    if (data) {
      return parseInt(data);
    }

    return -1;
  }


  public async getStartupData(): Promise<StartupData> {
    const loginData = await this.getLoginData();
    const activeUnit = await this.getActiveUnit();
    const activeCall = await this.getActiveCall();
    const pushNotifications = await this.getEnablePushNotifications();
    const themePreference = await this.getThemePreference();
    const keepAlive = await this.getKeepAlive();
    const headsetType = await this.getHeadsetType();
    const enableBackgroundGeolocation = await this.getEnableBackgroundGeolocation();
    const showAll = await this.getShowAll();

    return {
      loginData: loginData,
      activeUnitId: activeUnit,
      activeCallId: activeCall,
      pushNotificationsEnabled: pushNotifications,
      themePreference: themePreference,
      keepAlive: keepAlive,
      headsetType: headsetType,
      backgroundGeolocationEnabled: enableBackgroundGeolocation,
      showAll: showAll
    };
  }
}
