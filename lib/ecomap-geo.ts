/** Shared EcoMap geolocation constants and helpers (client + server). */

export const CHECKIN_RADIUS_M = 100;
/** Reject fixes worse than this — leaves margin within the 100m check-in radius. */
export const MAX_GPS_ACCURACY_M = 65;

/** Haversine distance in metres between two WGS-84 coordinates. */
export function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Conservative check-in range test.
 * GPS accuracy is a radius of uncertainty — worst case the user is `distance + accuracy` from the stop.
 */
export function isWithinCheckinRange(distanceM: number, accuracyM: number | null | undefined): boolean {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= 0) return false;
  if (accuracyM > MAX_GPS_ACCURACY_M) return false;
  return distanceM + accuracyM <= CHECKIN_RADIUS_M;
}

/** Human-readable reason why a check-in would be rejected, or null if in range. */
export function checkinRangeError(distanceM: number, accuracyM: number | null | undefined): string | null {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM <= 0) {
    return "Enable location before checking in.";
  }
  if (accuracyM > MAX_GPS_ACCURACY_M) {
    return `GPS accuracy is too low (±${Math.round(accuracyM)}m). Move to an open area and refresh your location.`;
  }
  const effective = distanceM + accuracyM;
  if (effective > CHECKIN_RADIUS_M) {
    const need = Math.ceil(effective - CHECKIN_RADIUS_M);
    return `Move about ${need}m closer (you're ~${Math.round(distanceM)}m away, GPS uncertainty ±${Math.round(accuracyM)}m).`;
  }
  return null;
}

export type GeoFix = { lat: number; lng: number; accuracyM: number };

/** Parse and validate client-submitted location fields. */
export function parseGeoFix(lat: unknown, lng: unknown, accuracyM: unknown): GeoFix | null {
  const latN = Number(lat);
  const lngN = Number(lng);
  const accN = Number(accuracyM);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN) || !Number.isFinite(accN) || accN <= 0) {
    return null;
  }
  if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return null;
  return { lat: latN, lng: lngN, accuracyM: accN };
}
