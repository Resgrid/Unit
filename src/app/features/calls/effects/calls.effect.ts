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
import { from, Observable, of, forkJoin } from 'rxjs';
import {
  CallFilesService,
  CallNotesService,
  CallsService,
  KazooVoiceService,
  SaveUnitStatusInput,
  UnitStatusService,
  VoiceService,
} from '@resgrid/ngx-resgridlib';
import { MenuController, ModalController } from '@ionic/angular';
import { HomeState } from '../../home/store/home.store';
import { selectHomeState, selectStatusesState } from 'src/app/store';
import { LoadingProvider } from 'src/app/providers/loading';
import { CallsState } from '../store/calls.store';
import * as callActions from '../actions/calls.actions';
import { ModalViewCallPage } from '../pages/view-call/view-call.page';

@Injectable()
export class CallsEffects {
  private _modalRef: HTMLIonModalElement;

  getCalls$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.GetCalls>(callActions.CallsActionTypes.GET_CALLS),
      tap(() => this.loadingProvider.show()),
      concatLatestFrom(() => [this.homeStore.select(selectHomeState)]),
      exhaustMap(([action, homeState], index) => {
        return this.callsProvider.getActiveCalls().pipe(
          map((data) => ({
            type: callActions.CallsActionTypes.GET_CALLS_DONE,
            calls: data.Data,
            priorities: homeState.callPriorties,
          })),
          catchError(() =>
            of({ type: callActions.CallsActionTypes.GET_CALLS_FAIL })
          )
        );
      })
    )
  );

  getCallById$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.GetCallById>(
        callActions.CallsActionTypes.GET_CALL_BYID
      ),
      tap(() => this.loadingProvider.show()),
      concatLatestFrom(() => [this.homeStore.select(selectHomeState)]),
      exhaustMap(([action, homeState], index) =>
        forkJoin([
          this.callsProvider.getCall(action.callId),
          this.callsProvider.getCallExtraData(action.callId),
        ]).pipe(
          map((result) => ({
            type: callActions.CallsActionTypes.GET_CALL_BYID_SUCCESS,
            call: result[0].Data,
            data: result[1].Data,
            priorities: homeState.callPriorties,
          })),
          catchError(() =>
            of({ type: callActions.CallsActionTypes.GET_CALL_BYID_FAIL })
          )
        )
      )
    )
  );

  getCallByIdSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(callActions.CallsActionTypes.GET_CALL_BYID_SUCCESS),
      switchMap(() => this.runModal(ModalViewCallPage, 'modal-container-full', null)),
      switchMap(() => this.loadingProvider.hide()),
      map(() => {
        return { type: callActions.CallsActionTypes.GET_CALL_BYID_DONE };
      })
    )
  );

  getCallByIdFail$ = createEffect(
    () => this.actions$.pipe(switchMap(() => this.loadingProvider.hide())),
    { dispatch: false }
  );

  getCallsDone$ = createEffect(() =>
    this.actions$.pipe(
      ofType(callActions.CallsActionTypes.GET_CALLS_DONE),
      switchMap(() => this.loadingProvider.hide())
    ),
    { dispatch: false }
  );

  showCallNotes$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.ShowCallNotesModal>(
        callActions.CallsActionTypes.SHOW_CALLNOTES
      ),
      mergeMap((action) =>
        this.callNotesProvider.getCallNotes(action.callId).pipe(
          map((data) => ({
            type: callActions.CallsActionTypes.OPEN_CALLNOTES,
            payload: data.Data,
          }))
        )
      )
    )
  );

  saveCallNote$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.SaveCallNote>(
        callActions.CallsActionTypes.SAVE_CALLNOTE
      ),
      mergeMap((action) =>
        this.callNotesProvider
          .saveCallNote(action.callId, action.userId, action.callNote, null)
          .pipe(
            // If successful, dispatch success action with result
            map((data) => ({
              type: callActions.CallsActionTypes.SHOW_CALLNOTES,
              callId: action.callId,
            })),
            // If request fails, dispatch failed action
            catchError(() =>
              of({ type: callActions.CallsActionTypes.SAVE_CALLNOTE_FAIL })
            )
          )
      )
    )
  );

  setVewCallBackToDefault$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.SetViewCallModal>(
        callActions.CallsActionTypes.SET_VIEW_CALL_MODAL
      ),
      map((data) => ({
        type: callActions.CallsActionTypes.DONE,
      }))
    )
  );

  openCallImagesModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.ShowCallImagesModal>(
        callActions.CallsActionTypes.SHOW_CALLIMAGES
      ),
      tap(() => this.loadingProvider.hide()),
      mergeMap((action) =>
        this.callFilesProvider.getCallImages(action.callId, true).pipe(
          map((data) => ({
            type: callActions.CallsActionTypes.OPEN_CALLIMAGES,
            payload: data.Data,
          }))
        )
      )
    )
  );

  openCallFilesModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.ShowCallFilesModal>(
        callActions.CallsActionTypes.SHOW_CALLFILESMODAL
      ),
      tap(() => this.loadingProvider.hide()),
      mergeMap((action) =>
        this.callFilesProvider.getCallFiles(action.callId, true).pipe(
          map((data) => ({
            type: callActions.CallsActionTypes.OPEN_CALLFILESMODAL,
            payload: data.Data,
          }))
        )
      )
    )
  );

  uploadCallImage$ = createEffect(() =>
    this.actions$.pipe(
      ofType<callActions.UploadCallImage>(
        callActions.CallsActionTypes.UPLOAD_CALLIMAGE
      ),
      mergeMap((action) =>
        this.callFilesProvider
          .saveCallImage(
            action.callId,
            action.userId,
            '',
            action.name,
            null,
            action.image
          )
          .pipe(
            // If successful, dispatch success action with result
            map((data) => ({
              type: callActions.CallsActionTypes.SHOW_CALLIMAGES,
              callId: action.callId,
            })),
            // If request fails, dispatch failed action
            catchError(() =>
              of({ type: callActions.CallsActionTypes.UPLOAD_CALLIMAGE_FAIL })
            )
          )
      )
    )
  );

  done$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<callActions.SetViewCallModal>(callActions.CallsActionTypes.DONE)
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private modalController: ModalController,
    private unitStatusService: UnitStatusService,
    private homeStore: Store<HomeState>,
    private callsStore: Store<CallsState>,
    private loadingProvider: LoadingProvider,
    private callsProvider: CallsService,
    private callNotesProvider: CallNotesService,
    private callFilesProvider: CallFilesService,
    private menuCtrl: MenuController
  ) {}

  runModal = async (component, cssClass, properties, opts = {}) => {
    this.closeModal();
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
    } catch (error) {}
  };
}
