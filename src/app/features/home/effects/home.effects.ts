import * as homeAction from '../actions/home.actions';
import { Action, Store } from '@ngrx/store';
import {
  Actions,
  concatLatestFrom,
  createEffect,
  Effect,
  ofType,
} from '@ngrx/effects';
import {
  catchError,
  exhaustMap,
  filter,
  map,
  mergeMap,
  switchMap,
  tap,
} from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { MenuController, ModalController } from '@ionic/angular';
import { AlertProvider } from 'src/app/providers/alert';
import { LoadingProvider } from 'src/app/providers/loading';
import { StorageProvider } from 'src/app/providers/storage';
import { Router } from '@angular/router';
import {
  MappingService,
  UnitStatusService,
  UnitLocationService,
  SaveUnitLocationInput,
  UnitRolesService,
} from '@resgrid/ngx-resgridlib';
import { HomeState } from '../store/home.store';
import { HomeProvider } from '../providers/home';
import { VoiceState } from '../../voice/store/voice.store';
import * as VoiceActions from '../../voice/actions/voice.actions';
import { selectHomeState } from 'src/app/store';
import { PushProvider } from 'src/app/providers/push';
import { ModalCallPush } from '../modals/callPush/modal-callPush.page';
import { GeolocationProvider } from 'src/app/providers/geolocation';

@Injectable()
export class HomeEffects {
  private _modalRef: HTMLIonModalElement;

  loadingMap$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.LoadingMap>(homeAction.HomeActionTypes.LOADING_MAP),
      mergeMap((action) =>
        this.mapProvider.getMapDataAndMarkers().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.LOADING_MAP_SUCCESS,
            payload: data.Data,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: homeAction.HomeActionTypes.LOADING_MAP_FAIL })
          )
        )
      )
    )
  );

  loadingMapSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.LOADING_MAP_SUCCESS),
        switchMap((action) => this.loadingProvider.hide())
      ),
    { dispatch: false }
  );

  loadingMapFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.LOADING_MAP_FAIL),
        switchMap((action) => this.loadingProvider.hide()),
        switchMap((action) => this.alertProvider.showErrorAlert(
          'Unable to load map data',
          '',
          'There was an issue trying to fetch the map data, please try again.'
        ))
      ),
    { dispatch: false }
  );

  loadAppData$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.LoadAppData>(homeAction.HomeActionTypes.LOADING_APP_DATA),
      mergeMap((action) =>
      this.homeProvider.getAppData().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.LOADING_APP_DATA_SUCCESS,
          payload: data,
        })),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.LOADING_APP_DATA_FAIL })
        )
      )
    )
    )
  );

  loadAppDataSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.LoadAppDataSuccess>(homeAction.HomeActionTypes.LOADING_APP_DATA_SUCCESS),
      switchMap((action) => this.loadingProvider.hide()),
      tap((action) => {
        this.voiceStore.dispatch(new VoiceActions.GetVoipInfo());
      }),
      tap((action) => {
        this.voiceStore.dispatch(new VoiceActions.GetAudioStreams());
      }),
      tap((action) => {
        this.store.dispatch(new homeAction.GetCurrentRoles());
      }),
      map((action) => ({
        type: homeAction.HomeActionTypes.LOADING_APP_DATA_DONE,
      }))
    )
  );

  loadAppDataFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.LOADING_APP_DATA_FAIL),
        switchMap((action) => this.loadingProvider.hide()),
        switchMap((action) => this.alertProvider.showErrorAlert(
          'Unable to load data',
          '',
          'There was an issue trying to fetch the app data, please try again.'
        ))
      ),
    { dispatch: false }
  );

  geolocationStartTracking$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.GEOLOCATION_START_TRACKING),
        switchMap((action) => this.geoProvider.startTracking())
      ),
    { dispatch: false }
  );

  geolocationStopTracking$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.GEOLOCATION_STOP_TRACKING),
        switchMap((action) => this.geoProvider.stopTracking())
      ),
    { dispatch: false }
  );

  backgroundGeolocationStartTracking$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.BACKGROUND_GEOLOCATION_START),
        switchMap((action) => this.geoProvider.initBackgroundGeolocation())
      ),
    { dispatch: false }
  );

  backgroundGeolocationStopTracking$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.BACKGROUND_GEOLOCATION_STOP),
        switchMap((action) => this.geoProvider.stopBackgroundGeolocation())
      ),
    { dispatch: false }
  );

  setActiveUnit$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SetActiveUnit>(
        homeAction.HomeActionTypes.SET_ACTIVEUNIT
      ),
      map((data) => {
        return {
          type: homeAction.HomeActionTypes.SET_ACTIVEUNIT_DONE,
        };
      })
    )
  );

  setActiveUnitDone$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.SET_ACTIVEUNIT_DONE),
        switchMap((action) => this.pushProvider.initPush())
      ),
    { dispatch: false }
  );

  closeModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.CLOSE_MODAL),
        switchMap((action) => this.closeModal())
      ),
    { dispatch: false }
  );

  setActiveCall$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SetActiveUnit>(
        homeAction.HomeActionTypes.SET_ACTIVECALL
      ),
      map((data) => {
        return {
          type: homeAction.HomeActionTypes.SET_ACTIVECALL_DONE,
        };
      })
    )
  );

  setActiveCallDone$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.SET_ACTIVECALL_DONE),
        tap((action) => {})
      ),
    { dispatch: false }
  );

  getCurrentStatusSet$ = createEffect(() =>
    this.actions$.pipe(
      ofType(homeAction.HomeActionTypes.GET_CURRENT_STATUS_SET),
      map((data) => {
        return {
          type: homeAction.HomeActionTypes.GET_CURRENT_STATUS_DONE,
        };
      })
    )
  );

  getCurrentStatusDone$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.GET_CURRENT_STATUS_DONE),
        tap((action) => {})
      ),
    { dispatch: false }
  );

  getCurrentStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GetCurrentStatus>(
        homeAction.HomeActionTypes.GET_CURRENT_STATUS
      ),
      concatLatestFrom(() => [this.store.select(selectHomeState)]),
      switchMap(([action, homeState], index) => {
        return this.unitStatusService
          .getUnitStatus(homeState.activeUnit?.UnitId)
          .pipe(
            map((data) => {
              return {
                type: homeAction.HomeActionTypes.GET_CURRENT_STATUS_SET,
                status: data.Data,
              };
            }),
            catchError(() =>
              of({
                type: homeAction.HomeActionTypes.GET_CURRENT_STATUS_DONE,
              })
            )
          );
      })
    )
  );

  getCurrentRoles$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GetCurrentRoles>(
        homeAction.HomeActionTypes.GET_CURRENT_ROLES
      ),
      concatLatestFrom(() => [this.store.select(selectHomeState)]),
      switchMap(([action, homeState], index) => {
        return this.unitRolesService
          .getRolesForUnit(homeState.activeUnit?.UnitId)
          .pipe(
            map((data) => {
              return {
                type: homeAction.HomeActionTypes.GET_CURRENT_ROLES_SET,
                roles: data.Data,
              };
            }),
            catchError(() =>
              of({
                type: homeAction.HomeActionTypes.GET_CURRENT_ROLES_DONE,
              })
            )
          );
      })
    )
  );

  geoPositionUpdate$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GeolocationLocationUpdate>(
        homeAction.HomeActionTypes.GEOLOCATION_LOCATION_UPDATE
      ),
      concatLatestFrom(() => [this.store.select(selectHomeState)]),
      switchMap(([action, homeState], index) => {
        if (homeState && homeState.activeUnit) {
          let date = new Date();
          let doSend = true;

          let location: SaveUnitLocationInput = {
            UnitId: homeState.activeUnit?.UnitId,
            Timestamp: date.toUTCString().replace('UTC', 'GMT'),
            Latitude: action.payload.Latitude?.toString(),
            Longitude: action.payload.Longitude?.toString(),
            Accuracy: action.payload.Accuracy?.toString(),
            Altitude: action.payload.Altitude?.toString(),
            AltitudeAccuracy: action.payload.AltitudeAccuracy?.toString(),
            Speed: action.payload.Speed?.toString(),
            Heading: action.payload.Heading?.toString(),
          };

          if (!homeState.currentPositionTimestamp) {
            console.log('does not have current position timestamp');
            doSend = true;
          } else {
            let diff =
              (date.getTime() - homeState.currentPositionTimestamp.getTime()) /
              30000;
            console.log('geolocation timestamp diff: ' + diff);

            if (diff >= 2) {
              doSend = true;
            } else {
              doSend = false;
            }
          }

          if (doSend) {
            return this.unitLocationService.saveUnitLocation(location).pipe(
              map((data) => {
                return {
                  type: homeAction.HomeActionTypes
                    .GEOLOCATION_LOCATION_UPDATE_SENT,
                };
              })
            );
          } else {
            return of({
              type: homeAction.HomeActionTypes.GEOLOCATION_LOCATION_UPDATE_DONE,
            });
          }
        } else {
          return of({
            type: homeAction.HomeActionTypes.GEOLOCATION_LOCATION_UPDATE_DONE,
          });
        }
      })
    )
  );

  startSignalR$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.START_SIGNALR),
        tap((action) => {
          this.homeProvider.startSignalR();
        })
      ),
    { dispatch: false }
  );

  stopSignalR$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.STOP_SIGNALR),
        tap((action) => {
          this.homeProvider.stopSignalR();
        })
      ),
    { dispatch: false }
  );

  pushNewCallReceived$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.PushCallReceived>(
        homeAction.HomeActionTypes.PUSH_CALLRECEIVED
      ),
      map((data) => {
        return {
          type: homeAction.HomeActionTypes.PUSH_CALLRECEIVED_SHOWMODAL,
        };
      })
    )
  );

  showPushNewCallReceivedModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.PUSH_CALLRECEIVED_SHOWMODAL),
        exhaustMap((data) => this.runModal(ModalCallPush, null, null))
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private store: Store<HomeState>,
    private modalController: ModalController,
    private alertProvider: AlertProvider,
    private loadingProvider: LoadingProvider,
    private storageProvider: StorageProvider,
    private mapProvider: MappingService,
    private router: Router,
    private geoProvider: GeolocationProvider,
    private homeProvider: HomeProvider,
    private voiceStore: Store<VoiceState>,
    private unitStatusService: UnitStatusService,
    private unitLocationService: UnitLocationService,
    private pushProvider: PushProvider,
    private menuCtrl: MenuController,
    private unitRolesService: UnitRolesService
  ) {}

  runModal = async (component, cssClass, properties) => {
    await this.closeModal();
    await this.menuCtrl.close();

    if (!cssClass) {
      cssClass = 'modal-container';
    }

    this._modalRef = await this.modalController.create({
      component: component,
      cssClass: cssClass,
      componentProps: {
        info: properties,
      },
    });

    return from(this._modalRef.present());
  };

  closeModal = async () => {
    //if (this._modalRef) {
    await this.modalController.dismiss();
    this._modalRef = null;
    //}
  };
}
