import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { AspectRatioComponent } from './aspect-ratio/aspect-ratio.component';
import { ImageShellComponent } from './image-shell/image-shell.component';
import { TextShellComponent } from './text-shell/text-shell.component';

@NgModule({
  declarations: [
    AspectRatioComponent,
    ImageShellComponent,
    TextShellComponent
  ],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [
    AspectRatioComponent,
    ImageShellComponent,
    TextShellComponent
  ]
})
export class ShellModule { }
