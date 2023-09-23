import { Component, OnInit, Output } from '@angular/core';
import { MenuController, Platform } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { SettingsState } from '../../../../features/settings/store/settings.store';
import * as SettingsActions from '../../../../features/settings/actions/settings.actions';
import { Observable, Subscription } from 'rxjs';
import { HomeState } from '../../store/home.store';
import {
  selectBackgroundGeolocationState,
  selectHeadsetType,
  selectHomeState,
  selectKeepAliveState,
  selectPushNotificationState,
  selectSelectedMic,
  selectSettingsState,
  selectThemePreferenceState,
} from 'src/app/store';
import { BluetoothProvider } from 'src/app/providers/bluetooth';
import { SubSink } from 'subsink';
import { SleepProvider } from 'src/app/providers/sleep';
//import { OpenViduDevicesService } from 'src/app/providers/openviduDevices';
import { IDevice } from 'src/app/models/deviceType';

@Component({
  selector: 'app-home-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public settingsState$: Observable<SettingsState | null>;

  public pushNotificationEnabled$: Observable<boolean | null>;
  public keepAlive$: Observable<boolean | null>;
  public backgroundGeolocationEnabled$: Observable<boolean | null>;
  public themePreference$: Observable<number | null>;

  public pushNotificationEnabled: boolean = false;
  public keepAliveEnabled: boolean = false;
  public isLoggedIn: boolean = false;

  public themePreference: string = '-1';
  public headSetType: string = '-1';

  private subs = new SubSink();

  public microphones: IDevice[] = [];
  public selectedMicrophone: string;

  public speakers: IDevice[] = [];
  public selectedSpeaker: IDevice;

  constructor(
    public menuCtrl: MenuController,
    private store: Store<SettingsState>,
    private homeStore: Store<HomeState>,
    private bluetoothProvider: BluetoothProvider,
    private sleepProvider: SleepProvider,
    private platform: Platform,
    //private deviceService: OpenViduDevicesService
  ) {
    this.homeState$ = this.homeStore.select(selectHomeState);
    this.settingsState$ = this.store.select(selectSettingsState);
    this.pushNotificationEnabled$ = this.store.select(selectPushNotificationState);
    this.keepAlive$ = this.store.select(selectKeepAliveState);
    this.backgroundGeolocationEnabled$ = this.store.select(selectBackgroundGeolocationState);
    this.themePreference$ = this.store.select(selectThemePreferenceState);
  }

  ngOnInit() {
    this.menuCtrl.enable(false);
  }

  ionViewWillEnter() {
    this.menuCtrl.enable(false);

    //this.subs.sink = this.store.select(selectPushNotificationState).subscribe(data =>
    //  this.pushNotificationEnabled = data
    //  );
    //this.subs.sink = this.store.select(selectPerferDarkModeState).subscribe(data =>
    //  this.perferDarkMode = data
    //  );
    //this.subs.sink = this.store.select(selectKeepAliveState).subscribe(data =>
    //  this.keepAliveEnabled = data
    //  );

    this.subs.sink = this.store.select(selectHeadsetType).subscribe((data) => {
      if (data) {
        this.headSetType = data.toString();
      }
    });

    this.subs.sink = this.store.select(selectSelectedMic).subscribe((data) => {
      if (data) {
        this.selectedMicrophone = data.toString();
      }
    });

    this.subs.sink = this.store.select(selectSettingsState).subscribe((data) => {
      if (data) {
        this.isLoggedIn = data.loggedIn;
      }
    });
  }

  async ionViewDidEnter() {
    this.menuCtrl.enable(false);

    //await this.deviceService.initDevices(); //.then(() => {
    //this.microphones = this.deviceService.getMicrophones();
    // this.selectedMicrophone = this.deviceService.getMicSelected();
    //});
  }

  ionViewWillLeave() {
    if (this.subs) {
      this.subs.unsubscribe();
    }
  }

  showLoginModal() {
    this.store.dispatch(new SettingsActions.ShowLoginModal());
  }

  showSetActiveModal() {
    this.store.dispatch(new SettingsActions.ShowSetActiveModal());
  }

  showSetServerAddressModal() {
    this.store.dispatch(new SettingsActions.ShowSetServerModal());
  }

  showsAboutModal() {
    this.store.dispatch(new SettingsActions.ShowAboutModal());
  }

  //async selectAudioDevice() { 
  //  await this.bluetoothProvider.init();
  // }

  public setBackgroundGeolocation(event) {

    if (event.detail.checked) {
      this.store.dispatch(
        new SettingsActions.ShowBackgroundGeolocationMessage()
      );
    }

    this.store.dispatch(
      new SettingsActions.SaveBackgroundGeolocationSetting(event.detail.checked)
    );
  }

  public setPushNotification(event) {
    this.store.dispatch(
      new SettingsActions.SavePushNotificationSetting(event.detail.checked)
    );
  }

  public setPerferDarkMode(event) {
    this.store.dispatch(
      new SettingsActions.SavePerferDarkModeSetting(parseInt(event))
    );
  }

  public setKeepAlive(event) {
    this.store.dispatch(
      new SettingsActions.SaveKeepAliveSetting(event.detail.checked)
    );

    if (event.detail.checked) {
      this.sleepProvider.enable();
    } else {
      this.sleepProvider.disable();
    }
  }

  public setHeadsetType(event) {
    this.headSetType = event;
    this.store.dispatch(
      new SettingsActions.SaveHeadsetTypeSetting(parseInt(event))
    );
  }

  public logOut() {
    this.store.dispatch(new SettingsActions.ShowPromptForLogout());
  }

  public isAndroid() {
    return this.platform.is('android');
  }

  public isIos() {
    return this.platform.is('ios');
  }

  public shouldHideLoginAndDevice(): boolean {
    if (!this.platform.is('android') || !this.platform.is('ios')) {
      return true;
    }

    if (!this.isLoggedIn) {
      return true;
    }
  }

  public async connectBle(): Promise<void> {
    await this.bluetoothProvider.init(parseInt(this.headSetType));
    await this.bluetoothProvider.start();
  }

  public setMic(event) {
    this.selectedMicrophone = event;
    //this.deviceService.setMicSelected(event);
    this.store.dispatch(new SettingsActions.SaveMicSetting(event));
  }
}
