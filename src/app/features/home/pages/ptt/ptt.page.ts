import { Component } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import {
  CallPriorityResultData,
  CallResultData,
  DepartmentVoiceChannelResultData,
} from '@resgrid/ngx-resgridlib';
import { Observable, Subscription } from 'rxjs';
import { CallsState } from 'src/app/features/calls/store/calls.store';
import { VoiceState } from 'src/app/features/voice/store/voice.store';
import { AudioProvider } from 'src/app/providers/audio';
//import { OpenViduService } from 'src/app/providers/openvidu';
import { selectCallsState, selectVoiceState } from 'src/app/store';
import * as CallsActions from '../../../calls/actions/calls.actions';
import * as VoiceActions from '../../../voice/actions/voice.actions';

@Component({
  selector: 'app-home-ptt',
  templateUrl: 'ptt.page.html',
  styleUrls: ['ptt.page.scss'],
})
export class PTTPage {
  public selectedChannel: DepartmentVoiceChannelResultData;
  public isTransmitting: boolean = false;
  public voiceState$: Observable<VoiceState | null>;

  private voiceSubscription: Subscription;

  constructor(
    private store: Store<VoiceState>,
    //public openViduService: OpenViduService,
    private audioProvider: AudioProvider
  ) {
    this.voiceState$ = this.store.select(selectVoiceState);
  }

  ionViewDidEnter() {
    this.voiceSubscription = this.voiceState$.subscribe((state) => {
      if (state) {
        if (state.currentActiveVoipChannel) {
          this.selectedChannel = state.currentActiveVoipChannel;
        } else if (state.channels) {
          this.selectedChannel = state.channels[0];
        }

        this.isTransmitting = state.isTransmitting;
      }
    });
  }

  ionViewWillLeave() {
    if (this.voiceSubscription) {
      this.voiceSubscription.unsubscribe();
      this.voiceSubscription = null;
    }
  }

  public toggleTransmitting() {
    if (this.isTransmitting) {
      this.stopTransmitting()
    } else {
      this.startTransmitting();
    }
  }

  public startTransmitting(): void {
    if (this.selectedChannel.Id !== '') {
      this.audioProvider.playTransmitStart();
      this.store.dispatch(new VoiceActions.StartTransmitting());
    }
  }

  public stopTransmitting(): void {
    if (this.selectedChannel.Id !== '') {
      this.store.dispatch(new VoiceActions.StopTransmitting());
      this.audioProvider.playTransmitEnd();
    }
  }

  public onChannelChange(channel) {
    if (this.isTransmitting) {
      this.stopTransmitting();
    } 

    if (channel.Id === '') {
      this.store.dispatch(new VoiceActions.SetNoChannel());
    } else {
      this.store.dispatch(new VoiceActions.SetActiveChannel(channel));
    }
  }
}
