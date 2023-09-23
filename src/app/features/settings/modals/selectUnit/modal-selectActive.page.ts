import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { passwordValidator } from 'src/app/validators/password.validator';
import { SettingsState } from '../../store/settings.store';
import * as SettingsActions from '../../actions/settings.actions';
import { HomeState } from 'src/app/features/home/store/home.store';
import { Observable } from 'rxjs';
import { selectHomeState } from 'src/app/store';
import { UnitResultData } from '@resgrid/ngx-resgridlib';
import { take } from 'rxjs/operators';
import * as _ from 'lodash';

@Component({
  selector: 'app-modal-selectActive',
  templateUrl: './modal-selectActive.page.html',
  styleUrls: ['./modal-selectActive.page.scss'],
})
export class ModalSelectActivePage implements OnInit {
  public selectedUnit: UnitResultData;
  public serverForm: UntypedFormGroup;
  public homeState$: Observable<HomeState | null>;

  constructor(
    private modal: ModalController,
    private formBuilder: UntypedFormBuilder,
    private store: Store<HomeState>
  ) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit() {
    this.homeState$.pipe(take(1)).subscribe((state) => {
      if (state && state.activeUnit) {
        this.selectedUnit = state.activeUnit;
      }
    });
  }

  dismissModal() {
    this.modal.dismiss();
  }

  compareWith(o1: UnitResultData, o2: UnitResultData) {
    return o1 && o2 ? o1.UnitId === o2.UnitId : o1 === o2;
  }

  save() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        if (this.selectedUnit) {
          const defaultStatuses = _.find(state.unitStatuses, ['UnitType', '0']);
          const statusesForType = _.find(state.unitStatuses, [
            'UnitType',
            this.selectedUnit.Type,
          ]);

          if (statusesForType) {
            this.store.dispatch(
              new SettingsActions.SetActiveUnit(
                this.selectedUnit,
                statusesForType
              )
            );
          } else {
            this.store.dispatch(
              new SettingsActions.SetActiveUnit(
                this.selectedUnit,
                defaultStatuses
              )
            );
          }
        }
      });
  }
}
