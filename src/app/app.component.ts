import { Component } from '@angular/core';
import { MenuController, ModalController, Platform } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { SettingsState } from './features/settings/store/settings.store';
import { StorageProvider } from './providers/storage';
import * as SettingsActions from './features/settings/actions/settings.actions';
import { Observable, Subscription } from 'rxjs';
import { HomeState } from './features/home/store/home.store';
import {
  selectActiveUnit,
  selectHomeState,
  selectIsAppActive,
  selectSettingsState,
  selectThemePreferenceState,
} from './store';
import { CallResultData, UnitResultData } from '@resgrid/ngx-resgridlib';
import * as HomeActions from './features/home/actions/home.actions';
import { take } from 'rxjs/operators';
import { CallsState } from './features/calls/store/calls.store';
import * as CallsActions from './features/calls/actions/calls.actions';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { TranslateService } from '@ngx-translate/core';
//import { HandsetProvider } from './providers/handset';
import { SleepProvider } from './providers/sleep';
import { PushNotifications } from '@capacitor/push-notifications';

declare var cordova: any;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  public noCallSelected: CallResultData;
  public noUnitSelected: UnitResultData;
  public homeState$: Observable<HomeState | null>;
  public activeUnit$: Observable<UnitResultData | null>;
  public themePreference$: Observable<number | null>;
  public isAppActive$: Observable<boolean | null>;

  private $activeUnitSub: Subscription;
  private $isActiveSub: Subscription;
  private $themePreferenceSub: Subscription;

  constructor(
    private platform: Platform,
    private storage: StorageProvider,
    public menu: MenuController,
    private store: Store<SettingsState>,
    private homeStore: Store<HomeState>,
    private callsStore: Store<CallsState>,
    private modalController: ModalController,
    private translateService: TranslateService,
    //private handsetProvider: HandsetProvider,
    private sleepProvider: SleepProvider
  ) {
    this.homeState$ = this.homeStore.select(selectHomeState);
    this.activeUnit$ = this.homeStore.select(selectActiveUnit);
    this.themePreference$ = this.store.select(selectThemePreferenceState);
    this.isAppActive$ = this.store.select(selectIsAppActive);

    this.noCallSelected = new CallResultData();
    this.noCallSelected.Name = 'No Call Selected';
    this.noCallSelected.CallId = '0';
    this.noCallSelected.Nature = 'Tap this card to select a call';

    this.noUnitSelected = new UnitResultData();
    this.noUnitSelected.Name = 'No Unit Selected';
    this.noUnitSelected.UnitId = '0';
    this.noUnitSelected.GroupName = 'Tap this card to select a unit';

    this.initializeApp();
  }

  async initializeApp() {
    const that = this;

    this.menu.enable(false);

    this.translateService.setDefaultLang('en');
    this.translateService.use('en');

    this.platform.ready().then(async () => {
      await this.storage.init();

      if (this.platform.is('ios')) {
      }

      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      this.toggleDarkTheme(prefersDark.matches);
      prefersDark.addListener((mediaQuery) =>
        this.toggleDarkTheme(mediaQuery.matches)
      );

      this.wireupAppEvents();
      await this.sleepProvider.init();
      await SplashScreen.hide();

      if (!this.$activeUnitSub || this.$activeUnitSub.closed) {
        this.$activeUnitSub = this.activeUnit$.subscribe((unit) => {
          if (unit) {
            this.homeStore.dispatch(new HomeActions.GetCurrentStatus());
          }
        });
      }

      if (!this.$isActiveSub || this.$isActiveSub.closed) {
        this.$isActiveSub = this.isAppActive$.subscribe((isActive) => {
          if (isActive) {
            this.homeStore
              .select(selectSettingsState)
              .pipe(take(1))
              .subscribe((state) => {
                if (state && state.user) {
                  this.homeStore.dispatch(new HomeActions.LoadAppData());
                }
              });
          }
        });
      }

      if (!this.$themePreferenceSub || this.$themePreferenceSub.closed) {
        this.$themePreferenceSub = this.themePreference$.subscribe(
          (themePref) => {
            const prefersDark = window.matchMedia(
              '(prefers-color-scheme: dark)'
            );
            this.toggleDarkTheme(prefersDark);
          }
        );
      }

      setTimeout(function () {
        that.store.dispatch(new SettingsActions.PrimeSettings());
      }, 1000);

      if (this.platform.is('ios') || this.platform.is('android')) {
        try {
          await PushNotifications.removeAllDeliveredNotifications();
        } catch (e) {
          console.log(e);
        }
      }
    });
  }

  // Add or remove the "dark" class based on if the media query matches
  private toggleDarkTheme(shouldAdd) {
    this.themePreference$.pipe(take(1)).subscribe((enableDarkMode) => {
      if (enableDarkMode === -1) {
        document.body.classList.toggle('dark', shouldAdd);
      } else if (enableDarkMode === 0) {
        document.body.classList.toggle('dark', false);
      } else if (enableDarkMode === 1) {
        document.body.classList.toggle('dark', true);
      }
    });
  }

  public triggerSelectCallModal() {
    this.store.dispatch(new SettingsActions.ShowSetActiveCallModal());
  }

  public triggerSelectUnitModal() {
    this.store.dispatch(new SettingsActions.ShowSetActiveModal());
  }

  public viewCall() {
    this.homeStore
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        if (state && state.activeCall) {
          this.callsStore.dispatch(
            new CallsActions.GetCallById(state.activeCall.CallId)
          );
        }
      });
  }

  private wireupAppEvents() {
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      this.modalController.getTop().then((popover) => {
        if (popover) {
          this.modalController.dismiss();
        } else {
          if (!canGoBack) {
            CapacitorApp.exitApp();
          } else {
            if (
              window.location.href.endsWith('/home/tabs/map') ||
              window.location.href.endsWith('/home/tabs')
            ) {
              return;
            } else {
              window.history.back();
            }
          }
        }
      });
    });

    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);

      this.store.dispatch(new SettingsActions.SetIsAppActive(isActive));
    });

    CapacitorApp.addListener('appUrlOpen', (data) => {
      console.log('App opened with URL:', data);
    });

    CapacitorApp.addListener('appRestoredResult', (data) => {
      console.log('Restored state:', data);
    });
  }
}
