import React, { useMemo } from 'react';

import Mapbox from '@/components/maps/mapbox';
import { createCirclePolygon, normalizeHeading } from '@/lib/map-camera';
import { isWeb } from '@/lib/platform';

/**
 * The unit's own location indicator, rendered as native map layers instead of a
 * view-based annotation. PointAnnotation children are rasterized to a snapshot
 * on iOS (and often render blank until refresh()), which is why the previous
 * view-based marker was invisible; GL layers always draw, rotate with the map,
 * and keep a correct screen size at every zoom.
 *
 * Bottom to top: GPS-accuracy circle (meters, geographic), heading arrow
 * (map-aligned so it points at the true ground direction even when the camera
 * is rotated), location dot.
 */

interface UnitLocationMarkerProps {
  latitude: number;
  longitude: number;
  /** Raw GPS heading — may be null or -1 when there is no fix. */
  heading: number | null;
  /** GPS fix accuracy radius in meters, or null when unknown. */
  accuracy: number | null;
}

const LOCATION_BLUE = '#3b82f6';

// Native resolves the bundled asset; mapbox-gl on web can't consume Metro asset
// ids, so web registers the same 64x56 chevron as a data URI.
const ARROW_IMAGE_NATIVE = require('@assets/mapping/direction_arrow.png');
const ARROW_IMAGE_WEB =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAA4CAYAAABNGP5yAAACL0lEQVR42u2ZPU7DQBCFfYMcIUfIAShScgAO4AtwAAokS3RUCxINBQUViihSgpAQUEGFK4REgTuQaCJR5D8smcgLo8Qm61k77G7mSU+y4rWlN57xfoqD4J8kpRTyVyJYJ00DN+SiGutUgDijAPG6hI9U4rvn8cxIke/h61N3IOln70tu7nfl1mFvdpwKztV9LsCNSnpwOZAbe92Z4RjpxtfwoUr4mIx/wivDb0ihb+FrqvVB0PbzBQiPe7gAsLbmUwHaKtnJ7XAhvDKcQ2r7Er6pEr28T3LDK791JrgITR9aP1Fptk/7SwsAa5ASp0cB427rYbQ0vDKsdR6TMe5CW8Oer1sAWIvYwE1Mxri70+prh1eGa5zF5HncLRpe2UlMzsJdagGcxOQ83KXaKUxehrtUO4HJOrhLtROYrIu7VFuNyUVxl2orMZmCu1RbiclU3KXaKkw2wV2qrcJkU9yl2gpMLgt3ncTkMnHXSUwuA3d3zwed66exOLsfCTh2BpNNcBeemrgYJK8fkxBvYXA8LUYI54p200oxmYq7sH8fXQ3bOvACa2At4K91mFwUd1WbU+YTrtEdj5Vgsi7u5rW5SdfpjEelmKyDu0Xa3OQh5I1HpZj8F+6atLnJNpw1HpVgchbult3mZY1HJZiMcRcqXHWbm47H3AsxNr1phLYX4cKfkimlCrRdRyY3ilPwce7zVPriDtMMddINAk/k1ad2FovFYrFYLBaLxWKxWCxTfQPDAf6eowsOPgAAAABJRU5ErkJggg==';

const UnitLocationMarker: React.FC<UnitLocationMarkerProps> = ({ latitude, longitude, heading, accuracy }) => {
  const safeHeading = normalizeHeading(heading);

  const locationPoint = useMemo(
    (): GeoJSON.Feature<GeoJSON.Point> => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
    }),
    [longitude, latitude]
  );

  const accuracyPolygon = useMemo(() => {
    if (accuracy == null || !Number.isFinite(accuracy) || accuracy <= 0) return null;
    return createCirclePolygon(longitude, latitude, accuracy);
  }, [longitude, latitude, accuracy]);

  const arrowImages = useMemo(() => ({ 'unit-heading-arrow': isWeb ? ARROW_IMAGE_WEB : ARROW_IMAGE_NATIVE }), []);

  return (
    <>
      {accuracyPolygon ? (
        <Mapbox.ShapeSource id="unit-location-accuracy" shape={accuracyPolygon}>
          <Mapbox.FillLayer
            id="unit-location-accuracy-fill"
            style={{
              fillColor: LOCATION_BLUE,
              fillOpacity: 0.12,
            }}
          />
          <Mapbox.LineLayer
            id="unit-location-accuracy-outline"
            style={{
              lineColor: LOCATION_BLUE,
              lineWidth: 1,
              lineOpacity: 0.35,
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}

      <Mapbox.Images images={arrowImages} />
      {safeHeading != null ? (
        <Mapbox.ShapeSource id="unit-location-heading-source" shape={locationPoint}>
          <Mapbox.SymbolLayer
            id="unit-location-heading"
            style={{
              iconImage: 'unit-heading-arrow',
              iconSize: 0.55,
              // Anchored at the icon's bottom edge (the location point) so the
              // rotation pivots there and the chevron orbits the dot.
              iconAnchor: 'bottom',
              iconRotate: safeHeading,
              // Map-aligned: the arrow keeps pointing at the true ground
              // heading even when the camera rotates behind the unit.
              iconRotationAlignment: 'map',
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
            }}
          />
        </Mapbox.ShapeSource>
      ) : null}
      <Mapbox.ShapeSource id="unit-location-point" shape={locationPoint}>
        <Mapbox.CircleLayer
          id="unit-location-dot"
          style={{
            circleRadius: 8,
            circleColor: LOCATION_BLUE,
            circleStrokeWidth: 3,
            circleStrokeColor: '#ffffff',
            circlePitchAlignment: 'map',
          }}
        />
      </Mapbox.ShapeSource>
    </>
  );
};

export default React.memo(UnitLocationMarker);
