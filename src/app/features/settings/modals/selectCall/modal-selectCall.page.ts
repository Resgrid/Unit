import { Component, OnInit } from '@angular/core';
import { FormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import * as SettingsActions from '../../actions/settings.actions';
import { HomeState } from 'src/app/features/home/store/home.store';
import { Observable } from 'rxjs';
import { selectHomeState } from 'src/app/store';
import { CallResultData, UnitResultData } from '@resgrid/ngx-resgridlib';
import { take } from 'rxjs/operators';
import * as _ from 'lodash';

@Component({
  selector: 'app-modal-selectCall',
  templateUrl: './modal-selectCall.page.html',
  styleUrls: ['./modal-selectCall.page.scss'],
})
export class ModalSelectCallPage implements OnInit {
  public selectedCall: CallResultData;
  public serverForm: UntypedFormGroup;
  public homeState$: Observable<HomeState | null>;
  public selectOptions: any;

  constructor(private modal: ModalController, private store: Store<HomeState>) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit() {
    this.selectOptions = {
      title: 'Select Call',
      subTitle: 'The active call your working',
      mode: 'lg'
    };
    
    this.homeState$.subscribe((state) => {
      if (state && state.activeCall) {
        this.selectedCall = state.activeCall;
      }
    });
  }

  dismissModal() {
    this.modal.dismiss();
  }

  compareWith(o1: CallResultData, o2: CallResultData) {
    return o1 && o2 ? o1.CallId === o2.CallId : o1 === o2;
  }

  save() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        if (this.selectedCall) {

          const defaultPriority = _.find(state.callPriorties, ['Id', 0]);
          const priorityForCall = _.find(state.callPriorties, [
            'Id',
            this.selectedCall.Priority,
          ]);

          if (priorityForCall) {
            this.store.dispatch(
              new SettingsActions.SetActiveCall(
                this.selectedCall,
                priorityForCall
              )
            );
          } else {
            this.store.dispatch(
              new SettingsActions.SetActiveCall(
                this.selectedCall,
                defaultPriority
              )
            );
          }
        }
      });
  }
}
