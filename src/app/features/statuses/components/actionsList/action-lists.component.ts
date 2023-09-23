import { Component, OnInit } from "@angular/core";
import { Store } from "@ngrx/store";
import { DepartmentVoiceChannelResultData, StatusesResultData } from '@resgrid/ngx-resgridlib';
import { Observable } from "rxjs";
import { take } from "rxjs/operators";
import { HomeState } from "src/app/features/home/store/home.store";
import { selectAvailableChannelsState, selectHomeState, selectVoiceState } from "src/app/store";
import { StatusesState } from "../../store/statuses.store";
import * as StatusesActions from '../../actions/statuses.actions';

@Component({
  selector: "app-action-lists",
  templateUrl: "./action-lists.component.html",
  styleUrls: ["./action-lists.component.scss"],
})
export class UnitActionsListComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;

  constructor(private store: Store<HomeState>, private statusesStore: Store<StatusesState>) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit(): void {
  }

  public submitStatus(status: StatusesResultData) {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        this.statusesStore.dispatch(
          new StatusesActions.SubmitUnitStatus(
            status,
            state.groups,
            state.calls
          )
        );
      });
  }
}
