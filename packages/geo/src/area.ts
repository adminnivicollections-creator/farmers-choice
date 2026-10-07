import { Geodesic } from 'geographiclib-geodesic';
import { AreaUnit, FEET_PER_METRE, fromSqm } from './units';

/**
 * Geodesic area and perimeter on the WGS84 ellipsoid.
 *
 * Why geographiclib and not a spherical formula (turf, shoelace-on-a-sphere):
 * a sphere is wrong by up to ~0.5% at these latitudes. On one acre that is
 * about 20 m2 -- half a cent. Land here is bought and sold in cents, so the
 * cheaper approximation is not cheap enough.
 *
 * Plain lat x lng or length x width is wrong by orders of magnitude and is
 * never used anywhere in this package.
 */

const geod = Geodesic.WGS84!;

export type LatLng = { latitude: number; longitude: number };

export type Measurement = {
  areaSquareMeters: number;
  areaSquareFeet: number;
  acres: number;
  cents: number;
  hectares: number;
  guntas: number;
  perimeterMeters: number;
  perimeterFeet: number;
  pointCount: number;
};

export const EMPTY_MEASUREMENT: Measurement = {
  areaSquareMeters: 0, areaSquareFeet: 0, acres: 0, cents: 0, hectares: 0,
  guntas: 0, perimeterMeters: 0, perimeterFeet: 0, pointCount: 0,
};

export function isValidLatLng(p: unknown): p is LatLng {
  if (!p || typeof p !== 'object') return false;
  const { latitude, longitude } = p as LatLng;
  return (
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180 &&
    // Null Island: almost always a GPS chip reporting "no fix", not a real place.
    !(latitude === 0 && longitude === 0)
  );
}

/** Geodesic distance between two points, in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  return geod.Inverse(a.latitude, a.longitude, b.latitude, b.longitude).s12 ?? 0;
}

/** Total length along an open path. */
export function pathLengthMetres(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMetres(points[i - 1], points[i]);
  return total;
}

/**
 * Area and perimeter of the closed polygon through `points`.
 *
 * Fewer than 3 points has no area, so it returns zeros rather than throwing --
 * the UI calls this on every tap while a boundary is still being drawn.
 * Area is returned unsigned, so winding order does not matter.
 */
export function measurePolygon(points: LatLng[]): Measurement {
  const valid = points.filter(isValidLatLng);
  if (valid.length < 3) {
    return {
      ...EMPTY_MEASUREMENT,
      pointCount: valid.length,
      perimeterMeters: pathLengthMetres(valid),
      perimeterFeet: pathLengthMetres(valid) * FEET_PER_METRE,
    };
  }

  const poly = geod.Polygon(false);
  for (const p of valid) poly.AddPoint(p.latitude, p.longitude);
  const r = poly.Compute(false, true);

  const areaSquareMeters = Math.abs(r.area ?? 0);
  const perimeterMeters = r.perimeter ?? 0;

  return {
    areaSquareMeters,
    areaSquareFeet: fromSqm(areaSquareMeters, 'sqft'),
    acres: fromSqm(areaSquareMeters, 'acre'),
    cents: fromSqm(areaSquareMeters, 'cent'),
    hectares: fromSqm(areaSquareMeters, 'hectare'),
    guntas: fromSqm(areaSquareMeters, 'gunta'),
    perimeterMeters,
    perimeterFeet: perimeterMeters * FEET_PER_METRE,
    pointCount: valid.length,
  };
}

/** Convenience for the unit dropdown. */
export function areaIn(m: Measurement, unit: AreaUnit): number {
  return fromSqm(m.areaSquareMeters, unit);
}

/**
 * Does the boundary cross itself? A self-intersecting ring still produces a
 * number from the geodesic engine, but it is not the area of any real plot --
 * so the UI warns instead of quietly showing a wrong figure.
 * Planar check on lat/lng; at parcel scale the distortion cannot flip a crossing.
 */
export function isSelfIntersecting(points: LatLng[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  const seg = (i: number) => [points[i], points[(i + 1) % n]] as const;

  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a.longitude - o.longitude) * (b.latitude - o.latitude) -
    (a.latitude - o.latitude) * (b.longitude - o.longitude);

  const crosses = (p1: LatLng, p2: LatLng, p3: LatLng, p4: LatLng) => {
    const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent segments: they share an endpoint by construction.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const [a1, a2] = seg(i), [b1, b2] = seg(j);
      if (crosses(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}
