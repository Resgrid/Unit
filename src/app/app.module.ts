import { NgModule } from '@angular/core';
import { BrowserModule, HammerModule, HAMMER_GESTURE_CONFIG } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { NgxResgridLibModule } from '@resgrid/ngx-resgridlib';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { metaReducers, reducers } from './reducers';
import { StoreModule } from '@ngrx/store';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { IonicStorageModule } from '@ionic/storage-angular';
import { CommonModule } from '@angular/common';
import { Drivers, Storage } from '@ionic/storage';
import { UnitCardComponent } from './features/home/components/units-card/unit-card.component';
import { VoiceModule } from './features/voice/voice.module';
import { StatusesModule } from './features/statuses/statuses.module';
import { StatusCardComponent } from './features/home/components/status-card/status-card.component';
import { CallsModule } from './features/calls/calls.module';
import { ComponentsModule } from './components/components.module';
import { SettingsModule } from './features/settings/settings.module';
import { HomeModule } from './features/home/home.module';
import { IonicGestureConfig } from './config/gesture.config';
import { CacheProvider } from './providers/cache';
import { RolesCardComponent } from './features/home/components/roles-card/roles-card.component';
import { VgCoreModule } from '@videogular/ngx-videogular/core';
import { VgControlsModule } from '@videogular/ngx-videogular/controls';
import { VgOverlayPlayModule } from '@videogular/ngx-videogular/overlay-play';
import { VgBufferingModule } from '@videogular/ngx-videogular/buffering';
import { NotesModule } from './features/notes/notes.module';
import { ShellModule } from './shell/shell.module';
import { ProtocolsModule } from './features/protocols/protocols.module';
import { RolesModule } from './features/roles/roles.module';

//import adapter from 'webrtc-adapter';

export function createTranslateLoader(http: HttpClient): any {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

let getBaseUrl = (): string => {
  const storedValue = localStorage.getItem(`RgUnitApp.serverAddress`);

  if (storedValue) {
    return storedValue.trim();
  }
  return environment.baseApiUrl;
};

@NgModule({
    declarations: [AppComponent,
        UnitCardComponent,
        StatusCardComponent,
        RolesCardComponent],
    imports: [
        BrowserModule,
        CommonModule,
        HttpClientModule,
        IonicStorageModule.forRoot(),
        NgxResgridLibModule.forRoot({
            baseApiUrl: getBaseUrl,
            apiVersion: 'v4',
            clientId: 'RgUnitApp',
            googleApiKey: environment.googleMapsKey,
            channelUrl: environment.channelUrl,
            channelHubName: environment.channelHubName,
            realtimeGeolocationHubName: environment.realtimeGeolocationHubName,
            logLevel: environment.logLevel,
            isMobileApp: true,
            cacheProvider: new CacheProvider()
        }),
        StoreModule.forRoot(reducers, { metaReducers }),
        EffectsModule.forRoot([]),
        StoreRouterConnectingModule.forRoot(),
        StoreDevtoolsModule.instrument({
            maxAge: 10,
            name: 'Resgrid Unit',
            logOnly: environment.production,
        }),
        IonicStorageModule.forRoot({
            name: '__RGUnit',
            driverOrder: [Drivers.IndexedDB, Drivers.LocalStorage],
        }),
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: createTranslateLoader,
                deps: [HttpClient],
            },
        }),
        IonicModule.forRoot({
            mode: 'md'
        }),
        AppRoutingModule,
        SettingsModule,
        HomeModule,
        VoiceModule,
        StatusesModule,
        CallsModule,
        ComponentsModule,
        HammerModule,
        VgCoreModule,
        VgControlsModule,
        VgOverlayPlayModule,
        VgBufferingModule,
        ShellModule,
        NotesModule,
        ProtocolsModule,
        RolesModule
    ],
    providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
    ],
    bootstrap: [AppComponent]
})
export class AppModule {}
