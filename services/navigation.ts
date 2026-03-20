
import { Garden } from '../types';
import { parseCoordinateDatum, parseCoordinateString, toGcj02, toWgs84 } from './coordinates';

const coordinateDatum = parseCoordinateDatum(import.meta.env.VITE_COORDINATE_DATUM);

const getRawCoordinates = (garden: Garden): { lat: number; lng: number } | null => {
  return parseCoordinateString(garden.location?.coordinates || '');
};

const getWgsCoordinates = (garden: Garden): { lat: number; lng: number } | null => {
  const raw = getRawCoordinates(garden);
  return raw ? toWgs84(raw, coordinateDatum) : null;
};

const getGcjCoordinates = (garden: Garden): { lat: number; lng: number } | null => {
  const raw = getRawCoordinates(garden);
  return raw ? toGcj02(raw, coordinateDatum) : null;
};

export const canNavigate = (garden: Garden): boolean => {
  const address = String(garden.location?.address || '').trim();
  if (!address || address === '地址不详') return false;
  return getRawCoordinates(garden) !== null;
};

export const openAppleMaps = (garden: Garden) => {
  const coords = getWgsCoordinates(garden);
  if (!coords) return;
  const { lat, lng } = coords;
  window.location.href = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
};

export const openGoogleMaps = (garden: Garden) => {
  const coords = getWgsCoordinates(garden);
  if (!coords) return;
  const { lat, lng } = coords;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
};

export const openAmap = (garden: Garden) => {
  const coords = getGcjCoordinates(garden);
  if (!coords) return;
  const { lat, lng } = coords;
  // Try to open Amap App Scheme, fallback to Web
  // Scheme: amapuri://route/plan/?dlat=...&dlon=...&dname=...&dev=0&t=0
  const name = encodeURIComponent(garden.name);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Attempt to open app with a timeout fallback to web
    const scheme = `amapuri://route/plan/?dlat=${lat}&dlon=${lng}&dname=${name}&dev=0&t=0`;
    
    // Simple approach for web apps: just prefer the web URI which handles app opening smartly on mobile
    window.location.href = scheme;
  } else {
    // Desktop Web
    window.open(`https://uri.amap.com/marker?position=${lng},${lat}&name=${name}`, '_blank');
  }
};
