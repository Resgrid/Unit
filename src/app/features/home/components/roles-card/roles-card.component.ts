import { Component, OnInit, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import { UnitResultData, UnitStatusResultData } from '@resgrid/ngx-resgridlib';
import { Observable } from 'rxjs';
import { selectCurrentUnitStatus, selectHomeState } from 'src/app/store';
import { HomeState } from '../../store/home.store';

@Component({
  selector: 'app-home-roles-card',
  templateUrl: './roles-card.component.html',
  styleUrls: ['./roles-card.component.scss'],
})
export class RolesCardComponent implements OnInit {
  public isVisible: boolean = false;
  public homeState$: Observable<HomeState | null>;

  @Input() color: string = 'gray';
  @Input() status: string = 'Unknown';

  constructor(private homeStore: Store<HomeState>) {
    this.homeState$ = this.homeStore.select(selectHomeState);
  }


  ngOnInit() {
    this.homeState$.subscribe(state => {
      if (state && state.roles) {
        if (state.roles.length > 0) {
          this.isVisible = true;
        } else {
          this.status = 'No Roles';
          this.isVisible = false;
        }
      } else {
        this.status = 'No Roles';
        this.isVisible = false;
      }
    });
  }

}
