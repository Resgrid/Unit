import { Store } from '@ngrx/store';
import { Actions, concatLatestFrom, createEffect, ofType } from '@ngrx/effects';
import { Injectable } from '@angular/core';
import {
  MenuController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import * as notesAction from './roles.actions';
import {
  NotesService,
  PersonnelService,
  UnitRolesService,
} from '@resgrid/ngx-resgridlib';
import { catchError, exhaustMap, map, mergeMap, switchMap, tap } from 'rxjs/operators';
import { StorageProvider } from 'src/app/providers/storage';
import * as _ from 'lodash';
import { forkJoin, from, of } from 'rxjs';
import { LoadingProvider } from 'src/app/providers/loading';
import { RolesState } from './roles.store';
import { ModalSetRolesPage } from '../pages/set-roles/modal-set-roles.page';
import { selectHomeState } from 'src/app/store';

@Injectable()
export class RolesEffects {
  private _modalRef: HTMLIonModalElement;

  getSetRoleData$ = createEffect(() =>
    this.actions$.pipe(
      ofType<notesAction.GetSetRoleData>(
        notesAction.RolesActionTypes.GET_SET_ROLE_DATA
      ),
      mergeMap((action) =>
        forkJoin([
          this.unitRolesService.getRolesForUnit(action.unitId),
          this.unitRolesService.getAllUnitRolesAndAssignmentsForDepartment(),
          this.personnelService.getAllPersonnelInfos(''),
        ]).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: notesAction.RolesActionTypes.GET_SET_ROLE_DATA_SUCCESS,
            roles: data[0].Data,
            unitRoleAssignments: data[1].Data,
            users: data[2].Data,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: notesAction.RolesActionTypes.GET_SET_ROLE_DATA_FAIL })
          )
        )
      )
    )
  );

  getSetRoleDataSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<notesAction.GetSetRoleDataSuccess>(
        notesAction.RolesActionTypes.GET_SET_ROLE_DATA_SUCCESS
      ),
      map((data) => {
        return {
          type: notesAction.RolesActionTypes.SHOW_SET_ROLE_MODAL,
        };
      })
    )
  );

  showSetRolesModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(notesAction.RolesActionTypes.SHOW_SET_ROLE_MODAL),
        exhaustMap((data) => this.runModal(ModalSetRolesPage, null, null))
      ),
    { dispatch: false }
  );

  saveRoleData$ = createEffect(() =>
		this.actions$.pipe(
			ofType<notesAction.SaveRoleData>(
				notesAction.RolesActionTypes.SAVE_ROLE_DATA
			),
			tap(() => this.loadingProvider.show()),
			mergeMap((action) =>
				this.unitRolesService.setRoleAssignmentsForUnit(action.assignments).pipe(
					map((data) => ({
						type: notesAction.RolesActionTypes.SAVE_ROLE_DATA_SUCCESS,
            unitId: action.assignments.UnitId,
					})),
					catchError(() =>
						of({
							type: notesAction.RolesActionTypes.SAVE_ROLE_DATA_FAIL,
						})
					)
				)
			)
		)
	);

	saveRoleDataSuccess$ = createEffect(() =>
		this.actions$.pipe(
      ofType<notesAction.SaveRoleDataSuccess>(
				notesAction.RolesActionTypes.SAVE_ROLE_DATA_SUCCESS
			),
			switchMap(async (action) => this.closeModal()),
      switchMap(async (action) => this.loadingProvider.hide()),
			map((action) => ({
				type: notesAction.RolesActionTypes.UPDATE_SET_ROLE_DATA,
			}))
		)
	);

  updateSetRoleData$ = createEffect(() =>
    this.actions$.pipe(
      ofType<notesAction.UpdateSetRoleData>(
        notesAction.RolesActionTypes.UPDATE_SET_ROLE_DATA
      ),
      concatLatestFrom(() => [this.store.select(selectHomeState)]),
      mergeMap(([action, homeState], index) =>
        forkJoin([
          this.unitRolesService.getRolesForUnit(homeState.activeUnit?.UnitId),
          this.unitRolesService.getAllUnitRolesAndAssignmentsForDepartment(),
          this.personnelService.getAllPersonnelInfos(''),
        ]).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: notesAction.RolesActionTypes.UPDATE_SET_ROLE_DATA_SUCCESS,
            roles: data[0].Data,
            unitRoleAssignments: data[1].Data,
            users: data[2].Data,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: notesAction.RolesActionTypes.UPDATE_SET_ROLE_DATA_FAIL })
          )
        )
      )
    )
  );

  saveRoleDataFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(notesAction.RolesActionTypes.SAVE_ROLE_DATA_FAIL),
        switchMap(async (action) => this.loadingProvider.hide()),
      ),
    { dispatch: false }
  );

  dismissModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(notesAction.RolesActionTypes.DISMISS_MODAL),
        exhaustMap((data) => this.closeModal())
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private store: Store<RolesState>,
    private notesProvider: NotesService,
    private toastController: ToastController,
    private menuCtrl: MenuController,
    private modalController: ModalController,
    private storageProvider: StorageProvider,
    private loadingProvider: LoadingProvider,
    private unitRolesService: UnitRolesService,
    private personnelService: PersonnelService
  ) {}

  showToast = async (message) => {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
    });
    toast.present();
  };

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
    } catch (error) {}
  };
}
