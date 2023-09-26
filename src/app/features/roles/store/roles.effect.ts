import { Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Injectable } from '@angular/core';
import {
	MenuController,
	ModalController,
	ToastController,
} from '@ionic/angular';
import * as notesAction from './roles.actions';
import { NotesService } from '@resgrid/ngx-resgridlib';
import {
	exhaustMap,
} from 'rxjs/operators';
import { StorageProvider } from 'src/app/providers/storage';
import * as _ from 'lodash';
import { from } from 'rxjs';
import { LoadingProvider } from 'src/app/providers/loading';
import { RolesState } from './roles.store';

@Injectable()
export class RolesEffects {
	private _modalRef: HTMLIonModalElement;

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
		private loadingProvider: LoadingProvider
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
		} catch (error) { }
	  };
}
