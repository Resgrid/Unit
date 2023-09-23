import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import * as SettingsActions from '../../../settings/actions/settings.actions';
import { HomeState } from 'src/app/features/home/store/home.store';
import { Observable } from 'rxjs';
import { selectHomeState, selectPushData } from 'src/app/store';
import { CallResultData, UnitResultData } from '@resgrid/ngx-resgridlib';
import { take } from 'rxjs/operators';
import * as _ from 'lodash';
import { PushData } from 'src/app/models/pushData';

@Component({
  selector: 'app-modal-callPush',
  templateUrl: './modal-callPush.page.html',
  styleUrls: ['./modal-callPush.page.scss'],
})
export class ModalCallPush implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public pushData$: Observable<PushData | null>;

  constructor(private modal: ModalController, private store: Store<HomeState>) {
    this.homeState$ = this.store.select(selectHomeState);
    this.pushData$ = this.store.select(selectPushData);
  }

  ngOnInit() {
    
  }

  public dismissModal() {
    this.modal.dismiss();
  }

  public set() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        if (state && state.pushData) {

          const call = _.find(state.calls, ['CallId', state.pushData.entityId]);

          const defaultPriority = _.find(state.callPriorties, ['Id', 0]);
          const priorityForCall = _.find(state.callPriorties, [
            'Id',
            call.Priority,
          ]);

          if (priorityForCall) {
            this.store.dispatch(
              new SettingsActions.SetActiveCall(
                call,
                priorityForCall
              )
            );
          } else {
            this.store.dispatch(
              new SettingsActions.SetActiveCall(
                call,
                defaultPriority
              )
            );
          }
        }

        this.modal.dismiss();
      });
  }
}
