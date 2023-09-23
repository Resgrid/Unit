import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { DeviceService, SaveUnitLocationInput, UnitLocationService } from '@resgrid/ngx-resgridlib';
import { StorageProvider } from './storage';
import { registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { Store } from '@ngrx/store';
import { HomeState } from '../features/home/store/home.store';
import { Geolocation, Position } from '@capacitor/geolocation';
import { GeoLocation } from '../models/geoLocation';
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation'
);
import * as HomeActions from '../features/home/actions/home.actions';
@Injectable({
  providedIn: 'root',
})
export class GeolocationProvider {
  isRegistering: boolean = false;
  watchPositionId : string = null;
  backgroundWatcherId : string = null;

  constructor(
    private platform: Platform,
    private storageProvider: StorageProvider,
    private deviceService: DeviceService,
    private unitLocationService: UnitLocationService,
    private store: Store<HomeState>
  ) {}

  public async getLocation(): Promise<GeoLocation> {
    let position: Position = null;

    try {
      position = await Geolocation.getCurrentPosition();
    } catch (err) {
      console.log(err);
    }

    if (
      position &&
      position.coords.latitude != 0 &&
      position.coords.longitude &&
      position.coords.longitude != 0
    ) {
      return new GeoLocation(
        position.coords.latitude,
        position.coords.longitude
      );
    }

    return null;
  }

  public async startTracking() {
    if (!this.watchPositionId) {
      this.watchPositionId = await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000
      }, (position, err) => {
        if (position) {
          let location = new GeoLocation(position.coords.latitude, position.coords.longitude);
          location.Accuracy = position.coords.accuracy;
          location.Altitude = position.coords.altitude;
          location.AltitudeAccuracy = position.coords.altitudeAccuracy;
          location.Heading = position.coords.heading;
          location.Speed = position.coords.speed;

          this.store.dispatch(
            new HomeActions.GeolocationLocationUpdate(location)
          );
        }
      });
    }
  }

  public async stopTracking() {
    if (this.watchPositionId) {
      await Geolocation.clearWatch({ id: this.watchPositionId });
      this.watchPositionId = null;
    }
  }

  public async initBackgroundGeolocation(): Promise<void> {
    const that = this;

    if (this.platform.is('mobile')) {
      let enableBackgroundGeolocation = await this.storageProvider.getEnableBackgroundGeolocation();
      let unitId = await that.storageProvider.getActiveUnit();

      if (unitId && enableBackgroundGeolocation) {
        this.backgroundWatcherId = await BackgroundGeolocation.addWatcher(
          {
            // If the "backgroundMessage" option is defined, the watcher will
            // provide location updates whether the app is in the background or the
            // foreground. If it is not defined, location updates are only
            // guaranteed in the foreground. This is true on both platforms.

            // On Android, a notification must be shown to continue receiving
            // location updates in the background. This option specifies the text of
            // that notification.
            backgroundMessage: 'Cancel to prevent battery drain and stop tracking.',

            // The title of the notification mentioned above. Defaults to "Using
            // your location".
            backgroundTitle: 'Resgrid Unit is using your location.',

            // Whether permissions should be requested from the user automatically,
            // if they are not already granted. Defaults to "true".
            requestPermissions: true,

            // If "true", stale locations may be delivered while the device
            // obtains a GPS fix. You are responsible for checking the "time"
            // property. If "false", locations are guaranteed to be up to date.
            // Defaults to "false".
            stale: false,

            // The minimum number of metres between subsequent locations. Defaults
            // to 0.
            distanceFilter: 20,
          },
          function callback(location, error) {
            if (error) {
              if (error.code === 'NOT_AUTHORIZED') {
                if (
                  window.confirm(
                    'This app needs your location, ' +
                      'but does not have permission.\n\n' +
                      'Open settings now?'
                  )
                ) {
                  // It can be useful to direct the user to their device's
                  // settings when location permissions have been denied. The
                  // plugin provides the 'openSettings' method to do exactly
                  // this.
                  BackgroundGeolocation.openSettings();
                }
              }
              return console.error(error);
            }

            if (location) {
              let date = new Date();

              let input = new SaveUnitLocationInput();
              input.UnitId = unitId;
              input.Timestamp = date.toUTCString().replace('UTC', 'GMT');
              input.Latitude = location.latitude.toString();
              input.Longitude = location.longitude.toString();

              if (location.accuracy) {
                input.Accuracy = location.accuracy.toString();
              }

              if (location.altitude) {
                input.Altitude = location.altitude.toString();
              }

              if (location.altitudeAccuracy) {
                input.AltitudeAccuracy = location.altitudeAccuracy.toString();
              }

              if (location.speed) {
                input.Speed = location.speed.toString();
              }

              if (location.bearing) {
                input.Heading = location.bearing.toString();
              }

              that.unitLocationService.saveUnitLocation(input).subscribe(data => {
                  if (data) {
                    
                  }
                });
            }
          }
        );
      }
    }
  }

  public async stopBackgroundGeolocation(): Promise<void> {
    if (this.backgroundWatcherId) {
      await BackgroundGeolocation.removeWatcher({
        id: this.backgroundWatcherId,
      });
      this.backgroundWatcherId = null;
    }
  }
}
