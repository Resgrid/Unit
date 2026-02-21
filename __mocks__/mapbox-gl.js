// Mock for mapbox-gl in Jest tests
module.exports = {
  accessToken: '',
  Map: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    remove: jest.fn(),
    addControl: jest.fn(),
    removeControl: jest.fn(),
    setCenter: jest.fn(),
    setZoom: jest.fn(),
    flyTo: jest.fn(),
    easeTo: jest.fn(),
    jumpTo: jest.fn(),
    resize: jest.fn(),
    getCanvas: jest.fn(() => ({
      style: {},
    })),
    getStyle: jest.fn(() => ({})),
    setStyle: jest.fn(),
  })),
  Marker: jest.fn().mockImplementation(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
    getLngLat: jest.fn(),
    setPopup: jest.fn().mockReturnThis(),
  })),
  Popup: jest.fn().mockImplementation(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setHTML: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
  NavigationControl: jest.fn(),
  GeolocateControl: jest.fn(),
  ScaleControl: jest.fn(),
  FullscreenControl: jest.fn(),
};
