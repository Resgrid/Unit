/**
 * @jest-environment jsdom
 */
/**
 * The web/Electron map path for uploaded pin icons, rendered into a real DOM.
 *
 * On web, `Mapbox.MarkerView` is map-view.web's `PointAnnotation`: it builds a mapbox-gl Marker around
 * a detached <div> and renders the pin into that <div> through its own react-dom root. Here (as in the
 * web bundle) react-native resolves to react-native-web and expo-image's `Image` renders through its web
 * view (`ExpoImage.web`), so these tests see the real <img>. The repo's Jest preset is the native one,
 * so the web modules are swapped in by the mocks below; mapbox-gl is the repo's __mocks__ stub.
 */
import mapboxgl from 'mapbox-gl';
import React, { act } from 'react';
// @ts-ignore - react-dom/client types are not installed
import { createRoot } from 'react-dom/client';

import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import MapPins from '../map-pins';
import { MapContext } from '../map-view.web';

jest.mock('react-native', () => jest.requireActual('react-native-web'));
// expo-image's real `Image`, with the web view it renders on web instead of the native one.
jest.mock('expo-image/src/ExpoImage', () => jest.requireActual('expo-image/src/ExpoImage.web'));
// Native-module and `expo` runtime imports the web view does not use (jest-expo's native mocks do not load under jsdom).
jest.mock('expo-image/src/ImageModule', () => ({ __esModule: true, default: { Image: class {} } }));
jest.mock('expo-image/src/observe', () => ({ initObserveIntegrationIfNeeded: jest.fn() }));
jest.mock('expo', () => ({ SharedRef: class SharedRef {} }));
jest.mock('@/components/maps/mapbox', () => jest.requireActual('@/components/maps/mapbox.web'));
// map-view.web's store-backed helpers are not used by markers.
jest.mock('@/lib/map-center', () => ({ getDepartmentMapCenter: jest.fn(() => null) }));
jest.mock('@/lib/map-style', () => ({ FALLBACK_DAY_MAP_STYLE: 'mapbox://styles/mapbox/streets-v12' }));
jest.mock('@/lib/mapbox-token', () => ({ onMapboxAccessTokenChange: jest.fn() }));

type MockMarker = { element: HTMLElement; anchor: string; setLngLat: jest.Mock; addTo: jest.Mock; remove: jest.Mock; setPopup: jest.Mock };

const ROLE_ICON_URL = 'https://cdn.example.test/roles/5/icon.png';
const PERSON_PIN_ID = 'p6f1c2a3b-0000-4000-8000-000000000001';

// One map instance for the whole test: PointAnnotation rebuilds its marker when the map changes.
const MAP_INSTANCE = {};

/** react-native-web's Image (the bundled pin): a 32x32 box that is not expo-image's. */
const findBundledIconBox = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLElement>('div')).find((node) => node.style.width === '32px' && node.style.height === '32px' && !node.hasAttribute('data-expoimage')) ?? null;

const makePersonPin = (overrides: Partial<MapMakerInfoData> = {}): MapMakerInfoData => ({
  Id: PERSON_PIN_ID,
  Longitude: -74.0,
  Latitude: 40.7,
  Title: 'Jane Smith',
  zIndex: 0,
  ImagePath: 'Person_RespondingCall',
  InfoWindowContent: '',
  Color: '',
  Type: 3,
  Marker: '',
  PoiImage: '',
  ...overrides,
});

describe('MapPins on web (mapbox-gl markers)', () => {
  let markers: MockMarker[];
  let host: HTMLDivElement;
  let root: { render: (node: React.ReactNode) => void; unmount: () => void };

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    markers = [];
    // The real Marker puts its element on the map; the mock puts it in the document so it can be inspected.
    (mapboxgl.Marker as unknown as jest.Mock).mockImplementation((options: { element: HTMLElement; anchor: string }) => {
      document.body.appendChild(options.element);
      const marker: MockMarker = {
        element: options.element,
        anchor: options.anchor,
        setLngLat: jest.fn().mockReturnThis(),
        addTo: jest.fn().mockReturnThis(),
        remove: jest.fn(() => options.element.remove()),
        setPopup: jest.fn().mockReturnThis(),
      };
      markers.push(marker);
      return marker;
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  const renderPins = (pins: MapMakerInfoData[]) => {
    act(() => {
      root.render(
        <MapContext.Provider value={MAP_INSTANCE}>
          <MapPins pins={pins} />
        </MapContext.Provider>
      );
    });
  };

  it('draws a personnel pin with its role icon as a plain <img>, centered and 32x32', () => {
    renderPins([makePersonPin({ IconUrl: ROLE_ICON_URL })]);

    expect(markers).toHaveLength(1);
    const [marker] = markers;
    // Center anchor, as on native: the uploaded icon has the bundled pin's footprint.
    expect(marker.anchor).toBe('center');
    expect(marker.setLngLat).toHaveBeenCalledWith([-74.0, 40.7]);

    const img = marker.element.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(ROLE_ICON_URL);
    expect(findBundledIconBox(marker.element)).toBeNull();
    // A plain cross-origin <img>: no CORS request, so the icon host needs no CORS headers.
    expect(img.hasAttribute('crossorigin')).toBe(false);
    // Grabbing the pin pans the map instead of dragging a ghost image.
    expect(img.getAttribute('draggable')).toBe('false');
    expect(img.style.objectFit).toBe('contain');

    const box = marker.element.querySelector('[data-testid="pin-type-icon"]') as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.contains(img)).toBe(true);
    expect(box.style.width).toBe('32px');
    expect(box.style.height).toBe('32px');
    expect(marker.element.textContent).toContain('Jane Smith');
  });

  it('falls back to the bundled person pin when the role icon fails to load', () => {
    renderPins([makePersonPin({ IconUrl: ROLE_ICON_URL })]);
    const [marker] = markers;

    act(() => {
      marker.element.querySelector('img')!.dispatchEvent(new Event('error'));
    });

    expect(marker.element.querySelector('[data-testid="pin-type-icon"]')).toBeNull();
    expect(marker.element.querySelector(`img[src="${ROLE_ICON_URL}"]`)).toBeNull();
    expect(findBundledIconBox(marker.element)).not.toBeNull();
    // Still the same marker, at the same anchor.
    expect(markers).toHaveLength(1);
    expect(marker.element.textContent).toContain('Jane Smith');
  });

  it('draws the bundled person pin when the person has no role icon', () => {
    renderPins([makePersonPin({ IconUrl: null })]);
    const [marker] = markers;

    expect(marker.anchor).toBe('center');
    expect(marker.element.querySelector('[data-testid="pin-type-icon"]')).toBeNull();
    expect(marker.element.querySelector('[data-expoimage]')).toBeNull();
    expect(findBundledIconBox(marker.element)).not.toBeNull();
  });

  it('moves the marker without reloading the role icon when a live location moves the pin', () => {
    const pin = makePersonPin({ IconUrl: ROLE_ICON_URL });
    renderPins([pin]);
    const [marker] = markers;
    const img = marker.element.querySelector('img');

    renderPins([{ ...pin, Latitude: 41.5, Longitude: -73.25 }]);

    // Same mapbox-gl Marker moved in place, same <img> element: no new marker, no new image request.
    expect(markers).toHaveLength(1);
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-73.25, 41.5]);
    expect(marker.element.querySelector('img')).toBe(img);
    expect(img!.getAttribute('src')).toBe(ROLE_ICON_URL);
  });

  describe('status / priority styled pins (PinIconUrl)', () => {
    const PIN_URL = 'https://api.example.test/api/v4/TypeIcons/Pins/Person-responding?v=1';
    const NEXT_PIN_URL = 'https://api.example.test/api/v4/TypeIcons/Pins/Person-onscene?v=1';

    it('draws the styled pin as a plain <img> in the bundled pin box: 32x32, cover fit, centered', () => {
      renderPins([makePersonPin({ PinIconUrl: PIN_URL, IconStyle: 'responding' })]);

      expect(markers).toHaveLength(1);
      const [marker] = markers;
      expect(marker.anchor).toBe('center');

      const img = marker.element.querySelector('img') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.getAttribute('src')).toBe(PIN_URL);
      expect(img.hasAttribute('crossorigin')).toBe(false);
      expect(img.getAttribute('draggable')).toBe('false');
      // Same fit as react-native-web's bundled pin (background-size: cover); no hue-rotate or other filter.
      expect(img.style.objectFit).toBe('cover');
      expect(img.style.filter).toBe('');
      expect(findBundledIconBox(marker.element)).toBeNull();

      const box = marker.element.querySelector('[data-testid="pin-styled-icon"]') as HTMLElement;
      expect(box).not.toBeNull();
      expect(box.contains(img)).toBe(true);
      expect(box.style.width).toBe('32px');
      expect(box.style.height).toBe('32px');
      expect(marker.element.textContent).toContain('Jane Smith');
    });

    it('draws the uploaded icon, not the styled pin, when both are sent', () => {
      renderPins([makePersonPin({ IconUrl: ROLE_ICON_URL, PinIconUrl: PIN_URL })]);
      const [marker] = markers;

      expect(marker.element.querySelector('[data-testid="pin-type-icon"]')).not.toBeNull();
      expect(marker.element.querySelector('[data-testid="pin-styled-icon"]')).toBeNull();
      expect(marker.element.querySelector(`img[src="${PIN_URL}"]`)).toBeNull();
      expect(marker.element.querySelector('img')!.getAttribute('src')).toBe(ROLE_ICON_URL);
    });

    it('falls back to the bundled pin when the styled pin fails to load', () => {
      renderPins([makePersonPin({ PinIconUrl: PIN_URL })]);
      const [marker] = markers;

      act(() => {
        marker.element.querySelector('img')!.dispatchEvent(new Event('error'));
      });

      expect(marker.element.querySelector('[data-testid="pin-styled-icon"]')).toBeNull();
      expect(marker.element.querySelector(`img[src="${PIN_URL}"]`)).toBeNull();
      expect(findBundledIconBox(marker.element)).not.toBeNull();
      expect(markers).toHaveLength(1);
    });

    it('redraws the same marker when a refetch only changes the status pin', () => {
      const pin = makePersonPin({ PinIconUrl: PIN_URL, IconStyle: 'responding' });
      renderPins([pin]);
      const [marker] = markers;

      renderPins([{ ...pin, PinIconUrl: NEXT_PIN_URL, IconStyle: 'onscene' }]);

      // Same mapbox-gl Marker (no teardown), now showing the new status pin.
      expect(markers).toHaveLength(1);
      expect(marker.remove).not.toHaveBeenCalled();
      expect(marker.element.querySelector('img')!.getAttribute('src')).toBe(NEXT_PIN_URL);
    });
  });
});
