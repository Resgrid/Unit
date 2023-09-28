import { Component, OnInit } from '@angular/core';
import { FormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { HomeState } from 'src/app/features/home/store/home.store';
import { Observable } from 'rxjs';
import { selectHomeState, selectRolesState } from 'src/app/store';
import {
  ActiveUnitRoleResultData,
  CallResultData,
  SetUnitRolesInput,
  SetUnitRolesRoleInput,
  UnitResultData,
  UnitRoleResultData,
} from '@resgrid/ngx-resgridlib';
import { take } from 'rxjs/operators';
import * as _ from 'lodash';
import { RolesState } from '../../store/roles.store';
import * as RolesActions from '../../store/roles.actions';

@Component({
  selector: 'app-modal-set-roles',
  templateUrl: './modal-set-roles.page.html',
  styleUrls: ['./modal-set-roles.page.scss'],
})
export class ModalSetRolesPage implements OnInit {
  public selectedCall: CallResultData;
  public serverForm: UntypedFormGroup;
  public rolesState$: Observable<RolesState | null>;
  public selectOptions: any;
  public selectedPersonnel: ActiveUnitRoleResultData[] = [];

  constructor(private modal: ModalController, private store: Store<HomeState>, private rolesStore: Store<RolesState>) {
    this.rolesState$ = this.store.select(selectRolesState);
  }

  ngOnInit() {}

  dismissModal() {
    this.modal.dismiss();
  }

  compareWith(o1: CallResultData, o2: CallResultData) {
    return o1 && o2 ? o1.CallId === o2.CallId : o1 === o2;
  }

  public filterRoles(
    roles: UnitRoleResultData[],
    unitRoleAssignments: ActiveUnitRoleResultData[]
  ) {
    let filteredRoles: ActiveUnitRoleResultData[] = [];

    if (roles &&
      roles.length > 0 &&
      unitRoleAssignments &&
      unitRoleAssignments.length > 0
    ) {
      unitRoleAssignments.forEach((ura) => {
        if (ura.UnitId === roles[0].UnitId) {
          filteredRoles.push(ura);
        }
      });
    }

    this.selectedPersonnel = _.cloneDeep(filteredRoles);
    return filteredRoles;
  }

  save() {
    let input: SetUnitRolesInput;
    input = {
      UnitId: this.selectedPersonnel[0].UnitId,
      Roles: [],
    };

    this.selectedPersonnel.forEach(person => {
      let role: SetUnitRolesRoleInput = {
        UserId: person.UserId,
        RoleId: person.UnitRoleId,
        Name: person.Name
      }

      input.Roles.push(role);
    });

    this.rolesStore.dispatch(new RolesActions.SaveRoleData(input));
  }
}
