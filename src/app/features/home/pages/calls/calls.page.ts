import { Component } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { CallPriorityResultData, CallResultData } from '@resgrid/ngx-resgridlib';
import { Observable } from 'rxjs';
import { CallsState } from 'src/app/features/calls/store/calls.store';
import { selectCallsState } from 'src/app/store';
import * as CallsActions from "../../../../features/calls/actions/calls.actions";

@Component({
  selector: 'app-home-calls',
  templateUrl: 'calls.page.html',
  styleUrls: ['calls.page.scss']
})
export class CallsPage {
  public callsState$: Observable<CallsState | null>;

  constructor(public menuCtrl: MenuController, private callsStore: Store<CallsState>) {
    this.callsState$ = this.callsStore.select(selectCallsState);
  }

  ionViewWillEnter() {
    this.menuCtrl.enable(false);

    this.callsStore.dispatch(
      new CallsActions.GetCalls()
    );
  }

  public viewCall(callId) {
    this.callsStore.dispatch(
      new CallsActions.GetCallById(callId)
    );
  }
}
