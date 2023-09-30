import { Component, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import {
	selectCallsState,
	selectMessagesState,
	selectNewCallLocationState,
	selectRecipientsState,
	selectSettingsState,
} from 'src/app/store';
import { MessagesState } from '../../../messages/store/messages.store';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import {
	MessageRecipientInput,
	MessageResultData,
	RecipientsResultData,
	UtilsService,
} from '@resgrid/ngx-resgridlib';
import { SubSink } from 'subsink';
import * as _ from 'lodash';
import { environment } from 'src/environments/environment';
import * as MessagesActions from '../../../messages/actions/messages.actions';
import { SettingsState } from 'src/app/features/settings/store/settings.store';
import { take } from 'rxjs/operators';
import { ModalController } from '@ionic/angular';
import { AlertProvider } from 'src/app/providers/alert';
import leaflet from 'leaflet';
import { GeolocationProvider } from 'src/app/providers/geolocation';
import * as CallsActions from '../../../../features/calls/actions/calls.actions';
import { CallsState } from '../../store/calls.store';
import { GeoLocation } from 'src/app/models/geoLocation';

@Component({
	selector: 'app-select-location',
	templateUrl: './select-location.page.html',
	styleUrls: ['./select-location.page.scss'],
})
export class SelectLocationPage {
	public callsState$: Observable<CallsState | null>;
	public newCallLocation$: Observable<GeoLocation | null>;
	private subs = new SubSink();

	public map: any;
	public marker: any;
	@ViewChild('callMap') mapContainer;

	constructor(
		private callsStore: Store<CallsState>,
		private geolocationProvider: GeolocationProvider
	) {
		this.callsState$ = this.callsStore.select(selectCallsState);
		this.newCallLocation$ = this.callsStore.select(selectNewCallLocationState);
	}

	async ionViewDidEnter() {
		await this.initMap();
	}

	ionViewDidLeave() {
		if (this.subs) {
			this.subs.unsubscribe();
		}
	}

	public closeModal() {
		this.callsStore.dispatch(new CallsActions.CloseSetLocationModal());
	}

	private async initMap() {
		this.newCallLocation$.pipe(take(1)).subscribe((position) => {
			if (this.map) {
				this.map.off();
				this.map.remove();
				this.map = null;
			}

			this.map = leaflet.map(this.mapContainer.nativeElement, {
				dragging: true,
				doubleClickZoom: false,
				zoomControl: true,
			});

			leaflet
				.tileLayer(
					'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=' + environment.mapTilerKey,
					{
						crossOrigin: true,
					}
				)
				.addTo(this.map);

			this.map.setView([position.Latitude, position.Longitude], 16);
			const that = this;

			this.marker = leaflet
				.marker([position.Latitude, position.Longitude], {
					icon: new leaflet.icon({
						iconUrl: '/assets/images/mapping/Call.png',
						iconSize: [32, 37],
						iconAnchor: [16, 37],
					}),
					draggable: true,
				})
				.on('dragend', function (ev) {
					var chagedPos = ev.target.getLatLng();

					that.callsStore.dispatch(
						new CallsActions.SetNewCallLocation(chagedPos.lat, chagedPos.lng)
					);
				});

			this.marker.addTo(this.map);

			this.map.on('click', function(e) {        
				if (that.marker) {
					that.marker.setLatLng(e.latlng);
				}
		
				that.callsStore.dispatch(
					new CallsActions.SetNewCallLocation(e.latlng.lat, e.latlng.lng)
				);       
			});

			setTimeout(function () {
				//window.dispatchEvent(new Event('resize'));
				//that.map.invalidateSize.bind(that.map)
				that.map.invalidateSize();
			}, 500);
		});
	}

	private addMarker(e) {
		// Add marker to map at click location; add popup window
		//var newMarker = new L.marker(e.latlng).addTo(map);

		if (this.marker) {
			this.marker.setLatLng(e.latlng);
		}

		this.callsStore.dispatch(
			new CallsActions.SetNewCallLocation(e.latlng.lat, e.latlng.lng)
		);
	}

	public setLocation() {
		this.callsStore.dispatch(new CallsActions.CloseSetLocationModal());
	}
}
