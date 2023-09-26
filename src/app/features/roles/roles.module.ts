import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NotesRoutingModule } from './roles-routing.module';
import { reducer } from './store/roles.reducer';
import { IonicModule } from '@ionic/angular';
import { HammerModule } from '@angular/platform-browser';
import { NgxResgridLibModule } from '@resgrid/ngx-resgridlib';
import { TranslateModule } from '@ngx-translate/core';
import { ShellModel } from 'src/app/shell/data-store';
import { ShellModule } from 'src/app/shell/shell.module';
import { RolesEffects } from './store/roles.effect';

@NgModule({
    declarations: [
        
    ],
    imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NotesRoutingModule,
        StoreModule.forFeature('rolesModule', reducer),
        EffectsModule.forFeature([RolesEffects]),
        HammerModule,
        NgxResgridLibModule,
        TranslateModule,
        ShellModule
    ],
    providers: [],
    exports: [
        
    ]
})
export class RolesModule { }
