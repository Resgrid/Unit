import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxResgridLibModule } from '@resgrid/ngx-resgridlib';
import { ComponentsModule } from 'src/app/components/components.module';
import { TranslateModule } from '@ngx-translate/core';
import { ModalSetRolesPage } from './modal-set-roles.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule.forChild([
      {
        path: '',
        component: ModalSetRolesPage
      }
    ]),
    NgxResgridLibModule,
    ComponentsModule,
    TranslateModule
  ],
  declarations: [ModalSetRolesPage]
})
export class ModalSetRolesPageModule {}
