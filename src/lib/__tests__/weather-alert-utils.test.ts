import { getPolygonBounds, parseCenterLocation, parsePolygonGeoJSON, parseWeatherAlertDate } from '@/lib/weather-alert-utils';

describe('weather-alert-utils', () => {
  describe('parseWeatherAlertDate', () => {
    it('parses the department 12-hour date format returned by Core', () => {
      const date = parseWeatherAlertDate('07/23/2026 4:15:30 PM');

      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(6);
      expect(date?.getDate()).toBe(23);
      expect(date?.getHours()).toBe(16);
      expect(date?.getMinutes()).toBe(15);
      expect(date?.getSeconds()).toBe(30);
    });

    it('parses the department 24-hour date format returned by Core', () => {
      const date = parseWeatherAlertDate('07/23/2026 16:15:30');

      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(16);
    });

    it('continues to support ISO timestamps', () => {
      expect(parseWeatherAlertDate('2026-07-23T23:15:30Z')?.toISOString()).toBe('2026-07-23T23:15:30.000Z');
    });

    it('rejects invalid dates instead of returning Invalid Date', () => {
      expect(parseWeatherAlertDate('02/30/2026 4:15:30 PM')).toBeNull();
      expect(parseWeatherAlertDate('not-a-date')).toBeNull();
    });
  });

  describe('weather alert geometry', () => {
    it('parses CAP coordinate strings and returns their bounds', () => {
      const polygon = parsePolygonGeoJSON('38,-120 39,-121 40,-120');

      expect(polygon).not.toBeNull();
      expect(polygon ? getPolygonBounds(polygon) : null).toEqual({
        ne: [-120, 40],
        sw: [-121, 38],
      });
    });

    it('calculates bounds across every polygon in a GeoJSON MultiPolygon', () => {
      const polygon = parsePolygonGeoJSON(
        JSON.stringify({
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-122, 37],
                [-121, 37],
                [-121, 38],
                [-122, 37],
              ],
            ],
            [
              [
                [-119, 39],
                [-118, 39],
                [-118, 40],
                [-119, 39],
              ],
            ],
          ],
        })
      );

      expect(polygon).not.toBeNull();
      expect(polygon ? getPolygonBounds(polygon) : null).toEqual({
        ne: [-118, 40],
        sw: [-122, 37],
      });
    });

    it('validates alert center coordinates', () => {
      expect(parseCenterLocation('39.5, -119.75')).toEqual({ latitude: 39.5, longitude: -119.75 });
      expect(parseCenterLocation('95,-119.75')).toBeNull();
      expect(parseCenterLocation('39.5,-181')).toBeNull();
    });
  });
});
