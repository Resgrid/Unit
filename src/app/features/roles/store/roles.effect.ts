import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
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
import { catchError, exhaustMap, map, mergeMap } from 'rxjs/operators';
import { StorageProvider } from 'src/app/providers/storage';
import * as _ from 'lodash';
import { forkJoin, from, of } from 'rxjs';
import { LoadingProvider } from 'src/app/providers/loading';
import { RolesState } from './roles.store';
import { ModalSetRolesPage } from '../pages/set-roles/modal-set-roles.page';

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
            roles: data[0],
            unitRoleAssignments: data[1],
            users: data[2],
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
