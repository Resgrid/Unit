import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CallCardComponent } from './call-card/call-card.component';
import { NgxResgridLibModule } from '@resgrid/ngx-resgridlib';
import { CTAPanelComponent } from './cta-panel/cta-panel';
import { NoteCardComponent } from './note-card/note-card.component';
import { ProtocolCardComponent } from './protocol-card/protocol-card.component';

@NgModule({
    imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NgxResgridLibModule
    ],
    declarations: [
        CallCardComponent,
        CTAPanelComponent,
        NoteCardComponent,
        ProtocolCardComponent
    ],
    exports: [
        CallCardComponent,
        CTAPanelComponent,
        NoteCardComponent,
        ProtocolCardComponent
    ]
})
export class ComponentsModule {}
