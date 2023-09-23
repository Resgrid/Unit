import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ModalController, Platform, ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
import {
  selectCallImagesState,
  selectCallsState,
  selectConfigData,
  selectHomeState,
  selectSettingsState,
} from 'src/app/store';
import * as _ from 'lodash';
import { CallsState } from '../../store/calls.store';
import {
  CallFileResultData,
  CallFilesService,
  GetConfigResultData,
  ResgridConfig,
  UtilsService,
} from '@resgrid/ngx-resgridlib';
import leaflet from 'leaflet';
import { environment } from 'src/environments/environment';
import { delay, take } from 'rxjs/operators';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import * as CallsActions from '../../actions/calls.actions';
import { SettingsState } from 'src/app/features/settings/store/settings.store';
import { GalleryItem, ImageItem } from 'ng-gallery';
import { encode } from 'base64-arraybuffer';
import { HomeState } from 'src/app/features/home/store/home.store';
import { CameraProvider } from 'src/app/providers/camera';

@Component({
  selector: 'app-page-view-call',
  templateUrl: './view-call.page.html',
  styleUrls: ['./view-call.page.scss'],
})
export class ModalViewCallPage implements AfterViewInit {
  public callsState$: Observable<CallsState | null>;
  public homeState$: Observable<HomeState | null>;
  public settingsState$: Observable<SettingsState | null>;
  public configData$: Observable<GetConfigResultData | null>;
  public selectOptions: any;
  public tabType: string = 'data';
  public viewType: string = 'call';

  private mapEnabled: boolean = false;
  private lat: string;
  private lng: string;
  public mapImgWidth: number;
  public mapImgHeight: number;
  public mapImgSrc: string;
  public map: any;
  public marker: any;
  @ViewChild('viewCallMap') mapContainer;

  public isSavingNote: boolean = false;
  public callNotesFormData: UntypedFormGroup;
  public imageNote: string = '';

  public images: GalleryItem[] = [];
  public callImages$: Observable<CallFileResultData[] | null>;

  private storeSub$: Subscription;
  private callImagesSub$: Subscription;

  constructor(
    private modal: ModalController,
    private store: Store<CallsState>,
    private config: ResgridConfig,
    private utilsService: UtilsService,
    public formBuilder: UntypedFormBuilder,
    private settingsStore: Store<SettingsState>,
    private homeStore: Store<HomeState>,
    private platform: Platform,
    private callFilesService: CallFilesService,
    private camera: CameraProvider,
    private toastCtrl: ToastController,
    private changeDetection: ChangeDetectorRef
  ) {
    this.callsState$ = this.store.select(selectCallsState);
    this.settingsState$ = this.settingsStore.select(selectSettingsState);
    this.homeState$ = this.homeStore.select(selectHomeState);
    this.callImages$ = this.store.select(selectCallImagesState);
    this.configData$ = this.store.select(selectConfigData);

    this.callNotesFormData = this.formBuilder.group({
      message: ['', [Validators.required]],
    });

    this.callImagesSub$ = this.callImages$.subscribe((callImages) => {
      this.images = [];
      if (callImages && callImages.length > 0) {
        callImages.forEach((image) => {
          this.images.push(new ImageItem({ src: image.Url }));
        });

        this.changeDetection.detectChanges();
      }
    });

    this.storeSub$ = this.callsState$.subscribe((state) => {
      if (state && state.callToView && state.viewCallType === 'call') {
        if (
          state.callToView.Geolocation &&
          state.callToView.Geolocation.length > 0
        ) {
          let coords = state.callToView.Geolocation.trim().split(',');

          if (coords.length === 2) {
            this.lat = coords[0].trim();
            this.lng = coords[1].trim();
            this.mapEnabled = true;
          }

          let that = this;
          setTimeout(function () {
            //window.dispatchEvent(new Event('resize'));
            //that.map.invalidateSize.bind(that.map)
            that.initMap();
          }, 500);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    //this.images = [];
  }

  dismissModal() {
    this.images = [];

    this.store
      .select(selectCallsState)
      .pipe(take(1))
      .subscribe((state) => {
        if (state && state.viewCallType === 'call') {
          if (this.storeSub$) {
            this.storeSub$.unsubscribe();
            this.storeSub$ = null;
          }

          if (this.callImagesSub$) {
            this.callImagesSub$.unsubscribe();
            this.callImagesSub$ = null;
          }
          this.modal.dismiss();
        } else {
          this.store.dispatch(new CallsActions.SetViewCallModal());
        }
      });
  }

  public getFullDateTime(dateToParse) {
    return this.utilsService.formatDateForDisplay(
      new Date(dateToParse),
      'yyyy-MM-dd HH:mm Z'
    );
  }

  public formatTimestamp(timestamp) {
    return this.utilsService.getDate(timestamp);
  }

  public navCallNotes() {
    this.store
      .select(selectCallsState)
      .pipe(take(1))
      .subscribe((state) => {
        if (state && state.callToView) {
          this.store.dispatch(
            new CallsActions.ShowCallNotesModal(state.callToView.CallId)
          );
        }
      });
  }

  public navCallImages() {
    this.store
      .select(selectCallsState)
      .pipe(take(1))
      .subscribe((state) => {
        if (state && state.callToView) {
          this.store.dispatch(
            new CallsActions.ShowCallImagesModal(state.callToView.CallId)
          );
        }
      });
  }

  public navCallFiles() {
    this.store
      .select(selectCallsState)
      .pipe(take(1))
      .subscribe((state) => {
        if (state && state.callToView) {
          this.store.dispatch(
            new CallsActions.ShowCallFilesModal(state.callToView.CallId)
          );
        }
      });
  }

  public route() {
    if (this.platform.is('ios')) {
      window.open(
        encodeURI('maps:daddr=' + this.lat + ' ' + this.lng),
        '_system'
      );
    } else if (this.platform.is('android')) {
      window.open(
        encodeURI('geo:0,0?q=' + this.lat + ',' + this.lng),
        '_system'
      );
    } else {
      window.open(
        encodeURI('maps:daddr=' + this.lat + ' ' + this.lng),
        '_system'
      );
    }
  }

  private initMap() {
    this.configData$.pipe(take(1)).subscribe((configData) => {
      if (this.mapEnabled) {
        //if (!this.map) {

        if (this.map) {
          this.map.off();
          this.map.remove();
          this.map = null;
        }

        this.map = leaflet.map(this.mapContainer.nativeElement, {
          dragging: false,
          doubleClickZoom: false,
          zoomControl: false,
        });

        leaflet
          .tileLayer(configData.MapUrl,
            {
              minZoom: 16,
              maxZoom: 16,
              crossOrigin: true,
            }
          )
          .addTo(this.map);

        this.map.setView([this.lat, this.lng], 16);

        this.marker = leaflet.marker([this.lat, this.lng], {
          icon: new leaflet.icon({
            iconUrl: 'assets/mapping/Call.png',
            iconSize: [32, 37],
            iconAnchor: [16, 37],
          }),
          draggable: false, //,
          //title: markerInfo.Title,
          //tooltip: markerInfo.Title
        });

        this.marker.addTo(this.map);
        //} else {
        // if (this.marker) {
        //    this.map.removeLayer(this.marker); // remove
        //  }

        //  this.marker = leaflet.marker([this.lat, this.lng], {
        //    icon: new leaflet.icon({
        //      iconUrl: 'assets/mapping/Call.png',
        //      iconSize: [32, 37],
        //      iconAnchor: [16, 37],
        //    }),
        //    draggable: false, //,
        //    //title: markerInfo.Title,
        //    //tooltip: markerInfo.Title
        // });

        //  this.marker.addTo(this.map);
        //}

        let that = this;
        setTimeout(function () {
          //window.dispatchEvent(new Event('resize'));
          //that.map.invalidateSize.bind(that.map)
          that.map.invalidateSize();
        }, 500);
      }
    });
  }

  public getDispatchUrl(fileId) {
    if (fileId && fileId.length > 0) {
      return (
        this.config.apiUrl +
        '/Calls/GetCallAudio?query=' +
        encodeURIComponent(fileId)
      );
    } else {
      return '';
    }
  }

  public getAvatarUrl(userId) {
    return this.config.apiUrl + '/Avatars/Get?id=' + userId;
  }

  public saveNote() {
    this.settingsStore
      .select(selectSettingsState)
      .pipe(take(1))
      .subscribe((settingsState) => {
        if (settingsState && settingsState.user) {
          this.store
            .select(selectCallsState)
            .pipe(take(1))
            .subscribe((state) => {
              if (state && state.callToView) {
                const note = this.callNotesFormData.value['message'];

                this.store.dispatch(
                  new CallsActions.SaveCallNote(
                    state.callToView.CallId,
                    note,
                    settingsState.user.userId
                  )
                );

                this.callNotesFormData.controls['message'].setValue('');
                this.callNotesFormData.controls['message'].patchValue('');
              }
            });
        }
      });
  }

  public async uploadPhoto() {
    const photo = await this.camera.getImage();
    //debugger;
    const base64Data = photo.base64String; //await this.camera.readAsBase64(photo);
    const fileName = new Date().getTime() + '.jpeg';

    this.homeState$.pipe(take(1)).subscribe((homeState) => {
      this.settingsState$.pipe(take(1)).subscribe((settingsState) => {
        this.callsState$.pipe(take(1)).subscribe((state) => {
          if (state && state.callToView) {
            let currentPosition = null;
            if (homeState && homeState.currentPosition) {
              currentPosition =
                homeState.currentPosition.Latitude +
                ',' +
                homeState.currentPosition.Longitude;
            }
            //debugger;
            this.callFilesService
              .saveCallImage(
                state.callToView.CallId,
                settingsState.user.userId,
                this.imageNote,
                fileName,
                homeState.currentPosition,
                base64Data
              )
              .subscribe(
                async (result) => {
                  const toast = await this.toastCtrl.create({
                    message:
                      'Photo uploaded successfully. Please wait for the call to be updated.',
                    duration: 3000,
                    position: 'top',
                    cssClass: 'toast-success',
                  });
                  toast.present();

                  this.store.dispatch(
                    new CallsActions.GetCallById(state.callToView.CallId)
                  );
                },
                async (err) => {
                  const toast = await this.toastCtrl.create({
                    message: 'Unable to upload photo. Please try again later.',
                    duration: 3000,
                    position: 'top',
                    cssClass: 'toast-error',
                  });
                  toast.present();
                }
              );
          }
        });
      });
    });
  }

  public openFile(file: CallFileResultData) {}

  public uploadFile() {}
}
