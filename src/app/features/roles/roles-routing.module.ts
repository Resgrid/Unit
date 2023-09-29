import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'setRoles',
    pathMatch: 'full'
  },
  {
    path: 'setRoles',
    loadChildren: () => import('./pages/set-roles/modal-set-roles.module').then(m => m.ModalSetRolesPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class NotesRoutingModule {}
