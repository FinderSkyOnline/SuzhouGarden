export interface LatLng {
  lat: number;
  lng: number;
}

export type CoordinateDatum = 'GCJ02' | 'WGS84';

const A = 6378245.0;
const EE = 0.00669342162296594323;
const PI = Math.PI;

const outOfChina = ({ lat, lng }: LatLng): boolean => {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
};

const transformLat = (x: number, y: number): number => {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) /
    3.0;
  ret +=
    ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
};

const transformLng = (x: number, y: number): number => {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret +=
    ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) *
      2.0) /
    3.0;
  return ret;
};

const delta = ({ lat, lng }: LatLng): LatLng => {
  const dLat = transformLat(lng - 105.0, lat - 35.0);
  const dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const mgLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  const mgLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: mgLat, lng: mgLng };
};

export const parseCoordinateString = (rawCoordinates: string): LatLng | null => {
  const raw = String(rawCoordinates || '').trim();
  if (!raw || !raw.includes(',')) return null;

  const [latStr, lngStr] = raw.split(',');
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
};

export const gcj02ToWgs84 = (coord: LatLng): LatLng => {
  if (outOfChina(coord)) return coord;

  const d = delta(coord);
  const mgLat = coord.lat + d.lat;
  const mgLng = coord.lng + d.lng;

  return {
    lat: coord.lat * 2 - mgLat,
    lng: coord.lng * 2 - mgLng,
  };
};

export const wgs84ToGcj02 = (coord: LatLng): LatLng => {
  if (outOfChina(coord)) return coord;

  const d = delta(coord);
  return {
    lat: coord.lat + d.lat,
    lng: coord.lng + d.lng,
  };
};

export const parseCoordinateDatum = (rawDatum: string | undefined): CoordinateDatum => {
  const normalized = String(rawDatum || '').trim().toUpperCase();
  return normalized === 'WGS84' ? 'WGS84' : 'GCJ02';
};

export const toWgs84 = (coord: LatLng, datum: CoordinateDatum): LatLng => {
  return datum === 'GCJ02' ? gcj02ToWgs84(coord) : coord;
};

export const toGcj02 = (coord: LatLng, datum: CoordinateDatum): LatLng => {
  return datum === 'WGS84' ? wgs84ToGcj02(coord) : coord;
};
