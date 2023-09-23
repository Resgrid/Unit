import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'map',
        loadChildren: () => import('../map/map.module').then(m => m.MapPageModule)
      },
      {
        path: 'calls',
        loadChildren: () => import('../calls/calls.module').then(m => m.CallsPageModule)
      },
      {
        path: 'ptt',
        loadChildren: () => import('../ptt/ptt.module').then(m => m.PttPageModule)
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/settings.module').then(m => m.SettingsPageModule)
      },
      {
        path: 'notes',
        loadChildren: () => import('../../../notes/pages/notes-list/notes-list.module').then(m => m.NotesListModule)
      },
      {
        path: 'protocols',
        loadChildren: () => import('../../../protocols/pages/protocols/protocols.module').then(m => m.ProtocolsModule)
      },
      {
        path: '',
        redirectTo: '/home/tabs/map',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/home/tabs/map',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
