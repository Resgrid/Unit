import * as statusesAction from '../actions/statuses.actions';
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
  map,
  mergeMap,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import {
  KazooVoiceService,
  SaveUnitStatusInput,
  UnitStatusService,
  VoiceService,
} from '@resgrid/ngx-resgridlib';
import { StatusDestination } from '../models/statusDestination';
import { ModalSetStatusDestinationPage } from '../modals/setStatusDestination/modal-setStatusDestination.page';
import { MenuController, ModalController } from '@ionic/angular';
import { ModalSetStatusNotePage } from '../modals/setStatusNote/modal-setStatusNote.page';
import { HomeState } from '../../home/store/home.store';
import { StatusesState } from '../store/statuses.store';
import { selectHomeState, selectStatusesState } from 'src/app/store';
import { LoadingProvider } from 'src/app/providers/loading';
import * as HomeActions from '../../../features/home/actions/home.actions';

@Injectable()
export class StatusesEffects {
  private _modalRef: HTMLIonModalElement;

  submitUnitStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType<statusesAction.SubmitUnitStatus>(
        statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_START
      ),
      tap((action) => {}),
      map((data) => {
        if (data && data.status) {
          if (data.status.Detail === 0) {
            // No detail
            return {
              type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE,
              status: data.status,
            };
          }

          let destinations: StatusDestination[] = [];

          if (data.status.Detail === 1) {
            //Stations
            data.groups.forEach((group) => {
              if (group.TypeId == 2) {
                destinations.push({
                  id: group.GroupId,
                  name: group.Name,
                  type: 1, // Station type
                });
              }
            });
          } else if (data.status.Detail === 2) {
            // Calls
            data.calls.forEach((call) => {
              destinations.push({
                id: call.CallId,
                name: call.Name,
                type: 2, // Call type
              });
            });
          } else if (data.status.Detail === 3) {
            // Calls and Stations
            data.groups.forEach((group) => {
              if (group.TypeId == 2) {
                destinations.push({
                  id: group.GroupId,
                  name: group.Name,
                  type: 1, // Station type
                });
              }
            });

            data.calls.forEach((call) => {
              destinations.push({
                id: call.CallId,
                name: call.Name,
                type: 2, // Call type
              });
            });
          }

          return {
            type: statusesAction.StatusesActionTypes
              .SUBMIT_UNIT_STATUS_DESTINATION,
            status: data.status,
            destinations: destinations,
          };
        } else {
          return {
            type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET,
          };
        }
      })
    )
  );

  submitUnitStatusDestinationSet$ = createEffect(() =>
    this.actions$.pipe(
      ofType<statusesAction.SubmitUnitStatus>(
        statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_DESTINATION_SET
      ),
      tap((action) => {}),
      map((data) => {
        if (data && data.status) {
          if (data.status.Note === 0) {
            //None = 0,
            //Optional = 1,
            //Required = 2

            // No Note
            return {
              type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET,
            };
          }

          return {
            type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE,
            status: data.status,
          };
        } else {
          return {
            type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET,
          };
        }
      })
    )
  );

  submitUnitStatusSet$ = createEffect(() =>
    this.actions$.pipe(
      ofType<statusesAction.SubmitUnitStatus>(
        statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET
      ),
      concatLatestFrom(() => [
        this.homeStore.select(selectHomeState),
        this.statusesStore.select(selectStatusesState),
      ]),
      switchMap(([action, homeState, statusesState], index) => {
        let unitStatus: SaveUnitStatusInput = new SaveUnitStatusInput();
        let date = new Date();

        unitStatus.Id = homeState.activeUnit?.UnitId;
        unitStatus.Type = statusesState.submittingUnitStatus.Id.toString();
        unitStatus.Timestamp = date.toISOString();
        unitStatus.TimestampUtc = date.toUTCString().replace('UTC', 'GMT');
        unitStatus.Note = statusesState.submittingUnitStatusNote;

        if (homeState.currentPosition) {
          if (homeState.currentPosition.Latitude) {
            unitStatus.Latitude = homeState.currentPosition.Latitude.toString();
          }

          if (homeState.currentPosition.Longitude) {
            unitStatus.Longitude =
              homeState.currentPosition.Longitude.toString();
          }

          if (homeState.currentPosition.Altitude) {
            unitStatus.Altitude = homeState.currentPosition.Altitude.toString();
          }

          if (homeState.currentPosition.Heading) {
            unitStatus.Heading = homeState.currentPosition.Heading.toString();
          }

          if (homeState.currentPosition.Speed) {
            unitStatus.Speed = homeState.currentPosition.Speed.toString();
          }

          if (homeState.currentPosition.Accuracy) {
            unitStatus.Accuracy = homeState.currentPosition.Accuracy.toString();
          }

          if (homeState.currentPosition.AltitudeAccuracy) {
            unitStatus.AltitudeAccuracy =
              homeState.currentPosition.AltitudeAccuracy.toString();
          }
        }
        //unitStatus.EventId
        //unitStatus.Roles: SaveUnitStatusRoleInput[];

        if (statusesState.submitStatusDestination) {
          unitStatus.RespondingTo =
            statusesState.submitStatusDestination.id.toString();
        }

        return this.unitStatusService.saveUnitStatus(unitStatus).pipe(
          map((data) => {
            return {
              type: statusesAction.StatusesActionTypes
                .SUBMIT_UNIT_STATUS_SET_DONE,
            };
          }),
          catchError(() =>
            of({
              type: statusesAction.StatusesActionTypes
                .SUBMIT_UNIT_STATUS_SET_ERROR,
            })
          )
        );
      })
    )
  );

  submitUnitStatusNote$ = createEffect(() =>
    this.actions$.pipe(
      ofType<statusesAction.SubmitUnitStatus>(
        statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE
      ),
      tap((action) => {}),
      map((data) => {
        if (data && data.status) {
          if (data.status.Note === 0) {
            //None = 0,
            //Optional = 1,
            //Required = 2

            // No Note
            return {
              type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET,
              status: data.status,
            };
          }

          return {
            type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE_MODAL,
          };
        } else {
          return {
            type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET,
          };
        }
      })
    )
  );

  submitUnitStatusNoteSet$ = createEffect(() =>
    this.actions$.pipe(
      ofType<statusesAction.SubmitUnitStatus>(
        statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE_SET
      ),
      switchMap(async (action) => this.closeModal()),
      switchMap(async (action) => this.loadingProvider.hide()),
      map((data) => {
        return {
          type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET,
        };
      })
    )
  );

  submitUnitStatusNoteModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_NOTE_MODAL
        ),
        exhaustMap((data) => this.runModal(ModalSetStatusNotePage, null, null, {
          breakpoints: [0, 0.2, 0.5],
          initialBreakpoint: 0.5,
        }))
      ),
    { dispatch: false }
  );

  
  submitUnitStatusDestination$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_DESTINATION
        ),
        concatLatestFrom(() => [
          this.homeStore.select(selectHomeState),
        ]),
        exhaustMap(([action, homeState], index) => {
          if (homeState.activeCall) {
            let componentProps = {
              'activeCallId': homeState.activeCall.CallId,
            };

            return this.runModal(ModalSetStatusDestinationPage, null, componentProps, {
              breakpoints: [0, 0.3, 0.5],
              initialBreakpoint: 0.3,
            });
          }

          return this.runModal(ModalSetStatusDestinationPage, null, null, {
            breakpoints: [0, 0.3, 0.5],
            initialBreakpoint: 0.3,
          });
        })
      ),
    { dispatch: false }
  );

  submitUnitStatusSetDone$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET_DONE),
        switchMap(() => this.closeModal()),
        switchMap(() => this.loadingProvider.hide()),
        tap(() => {
          this.homeStore.dispatch(new HomeActions.GetCurrentStatus());
        }),
        map((data) => {
          return {
            type: statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET_FINISH,
          };
        })
      )
  );

  submitUnitStatusSetError$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(statusesAction.StatusesActionTypes.SUBMIT_UNIT_STATUS_SET_ERROR),
        switchMap(() => this.closeModal()),
        switchMap(() => this.loadingProvider.hide()),
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private modalController: ModalController,
    private unitStatusService: UnitStatusService,
    private homeStore: Store<HomeState>,
    private statusesStore: Store<StatusesState>,
    private loadingProvider: LoadingProvider,
    private menuCtrl: MenuController
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

    return from(this._modalRef.present());
  };

  closeModal = async () => {
    try {
      //if (this._modalRef) {
        await this.modalController.dismiss();
        this._modalRef = null;
      //}
    } catch (error) { }
  };
}
