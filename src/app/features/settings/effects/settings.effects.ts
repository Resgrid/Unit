import * as settingsAction from '../actions/settings.actions';
import { Action, Store } from '@ngrx/store';
import {
  Actions,
  concatLatestFrom,
  createEffect,
  ofType,
} from '@ngrx/effects';
import {
  catchError,
  concatMap,
  exhaustMap,
  filter,
  map,
  mergeMap,
  switchMap,
  tap,
} from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { forkJoin, from, Observable, of } from 'rxjs';
import { SettingsState } from '../store/settings.store';
import { MenuController, ModalController, Platform } from '@ionic/angular';
import { ModalLoginPage } from '../modals/login/modal-login.page';
import { AuthProvider } from '../providers/auth';
import { AlertProvider } from 'src/app/providers/alert';
import { LoadingProvider } from 'src/app/providers/loading';
import { StorageProvider } from 'src/app/providers/storage';
import { Router } from '@angular/router';
import { ModalSelectActivePage } from '../modals/selectUnit/modal-selectActive.page';
import { ModalServerInfoPage } from '../modals/serverInfo/modal-serverInfo.page';
import { HomeState } from '../../home/store/home.store';
import * as homeActions from '../../../features/home/actions/home.actions';
import { ModalSelectCallPage } from '../modals/selectCall/modal-selectCall.page';
import { PushProvider } from 'src/app/providers/push';
import { SleepProvider } from 'src/app/providers/sleep';
import { ModalConfirmLogoutPage } from '../modals/confirmLogout/modal-confirmLogout.page';
import { ModalAboutPage } from '../modals/about/modal-about.page';
//import { HandsetProvider } from 'src/app/providers/handset';
import { BluetoothProvider } from 'src/app/providers/bluetooth';
import * as Sentry from "@sentry/angular";
import { VoiceState } from '../../voice/store/voice.store';
import * as VoiceActions from '../../voice/actions/voice.actions';
import { CacheProvider } from 'src/app/providers/cache';

@Injectable()
export class SettingsEffects {
  private _modalRef: HTMLIonModalElement;

  showLoginModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SHOW_LOGIN_MODAL),
        exhaustMap((data) => this.runModal(ModalLoginPage, null, null))
      ),
    { dispatch: false }
  );

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.Login>(settingsAction.SettingActionTypes.LOGIN),
      exhaustMap((action) =>
        this.authProvider
          .login(action.payload.username, action.payload.password)
          .pipe(
            mergeMap((data) =>
              from(this.storageProvider.setLoginData(data)).pipe(
                //filter((data) => !!data),
                map((data) => {
                  if (data && data.Rights) {
                    Sentry.setUser({ 
											username: data.sub, 
											email: data.Rights.EmailAddress,
											name: data.Rights.FullName,
											departmentId: data.Rights.DepartmentId,
											departmentName: data.Rights.DepartmentName });
                    
                    return {
                      type: settingsAction.SettingActionTypes
                        .SET_LOGINDATA_NAV_HOME,
                      user: {
                        userId: data.sub,
                        emailAddress: data.Rights.EmailAddress,
                        fullName: data.Rights.FullName,
                        departmentId: data.Rights.DepartmentId,
                        departmentName: data.Rights.DepartmentName,
                      },
                    };
                  } else {
                    return {
                      type: settingsAction.SettingActionTypes.NAV_SETTINGS,
                    };
                  }
                }),
                tap((data) => {
                  this.authProvider.startTrackingRefreshToken();
                }),
                catchError(() =>
                  of({ type: settingsAction.SettingActionTypes.LOGIN_FAIL })
                )
              )
            ),
            catchError(() =>
              of({ type: settingsAction.SettingActionTypes.LOGIN_FAIL })
            )
          )
      )
    )
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.LOGIN_SUCCESS),
        switchMap(() => this.loadingProvider.hide()),
        switchMap(() => this.router.navigate(['/home']))
      ),
    { dispatch: false }
  );

  loginDone$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.LOGIN_DONE),
        switchMap(() => this.loadingProvider.hide())
      ),
    { dispatch: false }
  );

  loginFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.LOGIN_FAIL),
        switchMap(() => this.loadingProvider.hide()),
        switchMap((action) =>
          this.alertProvider.showErrorAlert(
            'Login Error',
            '',
            'There was an issue trying to log you in, please check your username and password and try again.'
          )
        )
      ),
    { dispatch: false }
  );

  loggingIn$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.IS_LOGIN),
        switchMap(() => this.loadingProvider.show())
      ),
    { dispatch: false }
  );

  primeSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.PrimeSettings>(
        settingsAction.SettingActionTypes.PRIME_SETTINGS
      ),
      exhaustMap((action) =>
        forkJoin([
          this.storageProvider.getStartupData(),
          this.authProvider.refreshTokens(),
        ]).pipe(
          map((data) => {
            try {
              if (
                data &&
                data[0] &&
                data[0].loginData &&
                data[0].loginData.Rights
              ) {
                if (data[0].headsetType >= 0) {
                  if (this.platform.is('ios')) {
                    //this.bluetoothProvider
                    //  .init(data[0].headsetType)
                    //  .then((success) => console.log(`bluetooth success`))
                    //  .catch((err) => console.error(err));

                    //this.bluetoothProvider
                    //  .start()
                    //  .then((success) => console.log(`bluetooth success`))
                    //  .catch((err) => console.error(err));
                  } else if (this.platform.is('android')) {
                    //this.handsetProvider
                    //  .start()
                    //  .then((success) => console.log(`handset success`))
                    //  .catch((err) => console.error(err));
                  }
                }

                Sentry.setUser({ 
                  username: data[0].loginData.sub, 
                  email: data[0].loginData.Rights.EmailAddress,
                  name: data[0].loginData.Rights.FullName,
                  departmentId: data[0].loginData.Rights.DepartmentId,
                  departmentName: data[0].loginData.Rights.DepartmentName });

                return {
                  type: settingsAction.SettingActionTypes
                    .SET_LOGINDATA_NAV_HOME,
                  user: {
                    userId: data[0].loginData.sub,
                    emailAddress: data[0].loginData.Rights.EmailAddress,
                    fullName: data[0].loginData.Rights.FullName,
                    departmentId: data[0].loginData.Rights.DepartmentId,
                    departmentName: data[0].loginData.Rights.DepartmentName,
                  },
                  enablePushNotifications: data[0].pushNotificationsEnabled,
                  themePreference: data[0].themePreference,
                  keepAlive: data[0].keepAlive,
                  headsetType: data[0].headsetType,
                  backgroundGeolocationEnabled: data[0].backgroundGeolocationEnabled
                };
              } else {
                return {
                  type: settingsAction.SettingActionTypes.NAV_SETTINGS,
                };
              }
            } catch (error) {
              console.error(JSON.stringify(error));
              return {
                type: settingsAction.SettingActionTypes.NAV_SETTINGS,
              };
            }
          }),
          catchError(() =>
            of({ type: settingsAction.SettingActionTypes.NAV_SETTINGS })
          )
        )
      )
    )
  );

  setLoginDataNavHome$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SET_LOGINDATA_NAV_HOME),
        tap(() => {
          this.authProvider.startTrackingRefreshToken();
        }),
        switchMap(() => this.loadingProvider.hide()),
        switchMap(() => this.closeModal()),
        switchMap(() => this.router.navigate(['/home']))
      ),
    { dispatch: false }
  );

  navToSettings$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.NAV_SETTINGS),
        switchMap(() => this.router.navigate(['/home/tabs/settings']))
      ),
    { dispatch: false }
  );

  showSetActiveModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType(settingsAction.SettingActionTypes.SHOW_SETACTIVE_MODAL),
      switchMap(() =>
        this.runModal(ModalSelectActivePage, null, null, {
          breakpoints: [0, 0.3, 0.5],
          initialBreakpoint: 0.3,
        })
      ),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  setServerAddress$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SetServerAddress>(
        settingsAction.SettingActionTypes.SET_SERVERADDRESS
      ),
      tap((action) =>
        this.storageProvider.setServerAddress(action.serverAddress)
      ),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.SET_SERVERADDRESS_DONE,
        };
      })
    )
  );

  setServerAddressDone$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SET_SERVERADDRESS_DONE),
        switchMap((action) =>
          this.closeModal()
        ),
        switchMap((action) =>
          this.alertProvider.showOkAlert(
            'Resgrid Api',
            'Server Address Set',
            'The server address has been saved. You will need to quit the application completely and re-open for this to take effect.'
          )
        )
      ),
    { dispatch: false }
  );

  showSetServerAddressModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SHOW_SETSERVER_MODAL),
        switchMap((data) => this.runModal(ModalServerInfoPage, null, null))
      ),
    { dispatch: false }
  );

  setActiveUnit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<settingsAction.SetActiveUnit>(
          settingsAction.SettingActionTypes.SET_ACTIVEUNIT
        ),
        tap((action) => {
          this.homeStore.dispatch(
            new homeActions.SetActiveUnit(action.unit, action.statuses)
          );
        }),
        tap((action) => {
          this.voiceStore.dispatch(new VoiceActions.GetVoipInfo());
        }),
        switchMap((action) =>
          this.storageProvider.setActiveUnit(action.unit.UnitId)
        ),
        switchMap((action) => this.closeModal())
      ),
    { dispatch: false }
  );

  setActiveCall$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<settingsAction.SetActiveCall>(
          settingsAction.SettingActionTypes.SET_ACTIVECALL
        ),
        tap((action) => {
          this.homeStore.dispatch(
            new homeActions.SetActiveCall(action.call, action.priority)
          );
        }),
        switchMap(async (action) =>
          this.storageProvider.setActiveCall(action.call.CallId)
        ),
        switchMap(async (action) => this.closeModal())
      ),
    { dispatch: false }
  );

  showSetActiveCallModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SHOW_SETACTIVECALL_MODAL),
        exhaustMap((data) =>
          this.runModal(ModalSelectCallPage, null, null, {
            breakpoints: [0, 0.3, 0.5],
            initialBreakpoint: 0.3,
          })
        )
      ),
    { dispatch: false }
  );

  savePushNotificationSetting$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SavePushNotificationSetting>(
        settingsAction.SettingActionTypes.SAVE_PUSH_NOTIFICATION_SETTING
      ),
      switchMap((action) =>
        this.storageProvider.setEnablePushNotifications(
          action.enablePushNotifications
        )
      ),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  saveBackgroundGeolocationSetting$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SaveBackgroundGeolocationSetting>(
        settingsAction.SettingActionTypes.SAVE_BACKGROUND_GEOLOCATION_SETTING
      ),
      switchMap((action) =>
        this.storageProvider.setEnableBackgroundGeolocation(
          action.enableBackgroundGeolocation
        )
      ),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  savePerferDarkModeSetting$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SavePerferDarkModeSetting>(
        settingsAction.SettingActionTypes.SAVE_PERFER_DARKMODE_SETTING
      ),
      switchMap((action) =>
        this.storageProvider.setThemePreference(action.themePreference)
      ),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  saveKeepAliveSetting$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SaveKeepAliveSetting>(
        settingsAction.SettingActionTypes.SAVE_KEEP_ALIVE_SETTING
      ),
      switchMap(async (action) =>
        this.storageProvider.setKeepAlive(action.keepAlive)
      ),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  getApplicationSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.GetApplicationSettings>(
        settingsAction.SettingActionTypes.GET_APP_SETTINGS
      ),
      exhaustMap((action) =>
        forkJoin([
          from(this.storageProvider.getEnablePushNotifications()),
          from(this.storageProvider.getKeepAlive()),
          from(this.storageProvider.getThemePreference()),
          from(this.storageProvider.getHeadsetType()),
          from(this.storageProvider.getSelectedMic()),
          from(this.storageProvider.getEnableBackgroundGeolocation()),
        ]).pipe(
          map((result) => ({
            type: settingsAction.SettingActionTypes.SET_APP_SETTINGS,
            enablePushNotifications: result[0],
            keepAlive: result[1],
            themePreference: result[2],
            headsetType: result[3],
            selectedMic: result[4],
            enableBackgroundGeolocation: result[5],
          }))
        )
      )
    )
  );

  registerPush$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.REGISTER_PUSH),
        switchMap((action) => this.pushProvider.initPush())
      ),
    { dispatch: false }
  );

  showConfirmLogoff$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SHOW_LOGOUTPROMPT),
        exhaustMap((data) =>
          this.runModal(ModalConfirmLogoutPage, null, null, {
            breakpoints: [0, 0.2, 0.5, 1],
            initialBreakpoint: 0.2,
          })
        )
      ),
    { dispatch: false }
  );

  logoff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(settingsAction.SettingActionTypes.LOGOUT),
      switchMap(() => this.storageProvider.clear()),
      switchMap(() => this.cacheProvider.deleteAllCache()),
      tap(() => {
        this.authProvider.logout();
      }),
      switchMap(async () => this.closeModal()),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  showAboutModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SHOW_ABOUT_MODAL),
        exhaustMap((data) => this.runModal(ModalAboutPage, null, null))
      ),
    { dispatch: false }
  );

  saveHeadsetTypeSetting$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SaveHeadsetTypeSetting>(
        settingsAction.SettingActionTypes.SAVE_HEADSET_TYPE_SETTING
      ),
      switchMap((action) =>
        this.storageProvider.setHeadsetType(action.headsetType)
      ),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  saveSelectMic$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SaveMicSetting>(
        settingsAction.SettingActionTypes.SAVE_MIC_SETTING
      ),
      switchMap((action) => this.storageProvider.setSelectedMic(action.mic)),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  setIsAppActive$ = createEffect(() =>
    this.actions$.pipe(
      ofType<settingsAction.SetIsAppActive>(
        settingsAction.SettingActionTypes.SET_IS_APP_ACTIVE
      ),
      tap((action) => {
        if (!action.isActive) {
          this.homeStore.dispatch(new homeActions.GeolocationStopTracking());
          this.homeStore.dispatch(new homeActions.BackgroundGeolocationStart());
        } else {
					this.homeStore.dispatch(new homeActions.GeolocationStartTracking());
					this.homeStore.dispatch(new homeActions.BackgroundGeolocationStop());
				}
      }),
      map((data) => {
        return {
          type: settingsAction.SettingActionTypes.DONE,
        };
      })
    )
  );

  done$ = createEffect(
    () => this.actions$.pipe(ofType(settingsAction.SettingActionTypes.DONE)),
    { dispatch: false }
  );

  dismissModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.DISMISS_MODAL),
        switchMap(() => this.closeModal())
      ),
    { dispatch: false }
  );

  showBackgroundGeolocationMessage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(settingsAction.SettingActionTypes.SHOW_BACKGROUND_GEOLOCATION_MSG),
        switchMap((action) => this.alertProvider.showOkAlert(
          'Background Geolocation',
          '',
          'If you enable background geolocation Resgrid Unit will continue to send your position to the server even if you are not in the app.',
        ))
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private store: Store<SettingsState>,
    private modalController: ModalController,
    private authProvider: AuthProvider,
    private alertProvider: AlertProvider,
    private loadingProvider: LoadingProvider,
    private storageProvider: StorageProvider,
    private router: Router,
    private pushProvider: PushProvider,
    private homeStore: Store<HomeState>,
    //private handsetProvider: HandsetProvider,
    private menuCtrl: MenuController,
    private platform: Platform,
    private bluetoothProvider: BluetoothProvider,
    private voiceStore: Store<VoiceState>,
    private cacheProvider: CacheProvider
  ) {}

  runModal = async (component, cssClass, properties, opts = {}) => {
    await this.closeModal();
    await this.menuCtrl.close();

    if (!cssClass) {
      cssClass = 'modal-container';
    }

    this._modalRef = await this.modalController.create({
      component: component,
      cssClass: cssClass,
      componentProps: properties,
      ...opts,
    });

    return this._modalRef.present();
  };

  closeModal = async () => {
    try {
      if (this._modalRef) {
        await this.modalController.dismiss();
        this._modalRef = null;
      }
    } catch (error) {
      this._modalRef = null;
    }
  };
}
