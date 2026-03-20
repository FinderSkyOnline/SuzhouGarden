import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, MapPin, X } from 'lucide-react';
import { Garden } from '../types';
import {
  CoordinateDatum,
  parseCoordinateDatum,
  parseCoordinateString,
  toGcj02,
  toWgs84,
} from '../services/coordinates';

type MapProvider = 'apple' | 'tencent';
type ProviderMode = 'auto' | MapProvider;

declare global {
  interface Window {
    mapkit?: any;
    TMap?: any;
    _TMapSecurityConfig?: {
      serviceHost?: string;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_APPLE_MAPKIT_JWT?: string;
    readonly VITE_TENCENT_MAP_KEY?: string;
    readonly VITE_TENCENT_MAP_STYLE_ID?: string;
    readonly VITE_TENCENT_MAP_SERVICE_HOST?: string;
    readonly VITE_COORDINATE_DATUM?: CoordinateDatum;
    readonly VITE_MAP_PROVIDER?: ProviderMode;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

interface GardensMapOverlayProps {
  gardens: Garden[];
  isDark: boolean;
  onClose: () => void;
}

interface GardenPoint {
  garden: Garden;
  index: number;
  appleLat: number;
  appleLng: number;
  tencentLat: number;
  tencentLng: number;
}

type GardenStatus = 'open' | 'closed' | 'renovation';

interface GardenStatusMeta {
  key: GardenStatus;
  label: string;
  dotColor: string;
  lineColor: string;
}

interface TencentMarkerAsset {
  src: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

const MAPKIT_SCRIPT_ID = 'apple-mapkit-js';
const MAPKIT_SCRIPT_SRC = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
const TENCENT_SCRIPT_ID = 'tencent-map-gljs';

let mapKitScriptPromise: Promise<void> | null = null;
let tencentScriptPromise: Promise<void> | null = null;
let tencentScriptIdentity = '';

const parseProviderMode = (raw: string | undefined): ProviderMode => {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'apple' || normalized === 'tencent') return normalized;
  return 'auto';
};

const parseTencentStyleId = (raw: string | undefined): string => {
  const styleId = String(raw || '').trim().toLowerCase();
  if (!styleId) return '';
  return /^style\d+$/.test(styleId) ? styleId : '';
};

const normalizeGardenStatus = (raw: string | undefined): GardenStatus => {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ');

  if (
    normalized.includes('renovation') ||
    normalized.includes('renovating') ||
    normalized.includes('repair') ||
    normalized.includes('restoration')
  ) {
    return 'renovation';
  }

  if (
    normalized === 'open' ||
    normalized.includes('开放') ||
    normalized.includes('营业')
  ) {
    return 'open';
  }

  if (
    normalized.includes('closed') ||
    normalized.includes('not open') ||
    normalized.includes('notopen') ||
    normalized.includes('未开放') ||
    normalized.includes('暂停')
  ) {
    return 'closed';
  }

  return 'closed';
};

const getGardenStatusMeta = (raw: string | undefined): GardenStatusMeta => {
  const status = normalizeGardenStatus(raw);
  if (status === 'open') {
    return {
      key: 'open',
      label: '开放中',
      dotColor: '#22c55e',
      lineColor: '#16a34a',
    };
  }

  if (status === 'renovation') {
    return {
      key: 'renovation',
      label: '修缮中',
      dotColor: '#f59e0b',
      lineColor: '#d97706',
    };
  }

  return {
    key: 'closed',
    label: '未开放',
    dotColor: '#f97316',
    lineColor: '#ea580c',
  };
};

const hexToRgba = (hex: string, alpha: number): string => {
  const raw = hex.replace('#', '');
  const fullHex = raw.length === 3 ? raw.split('').map((ch) => `${ch}${ch}`).join('') : raw;
  const value = Number.parseInt(fullHex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const escapeSvgText = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const truncateMarkerName = (name: string, maxChars = 10): string => {
  const chars = Array.from(String(name || '').trim());
  if (chars.length <= maxChars) return chars.join('') || '未命名园林';
  return `${chars.slice(0, maxChars - 1).join('')}…`;
};

const estimateMarkerNameWidth = (text: string, fontSize: number): number =>
  Array.from(text).reduce((sum, ch) => sum + (/[\u3400-\u9fff]/.test(ch) ? fontSize * 0.95 : fontSize * 0.62), 0);

const buildTencentMarkerAsset = (name: string, isDark: boolean): TencentMarkerAsset => {
  const label = truncateMarkerName(name, 10);
  const safeLabel = escapeSvgText(label);
  const markerColor = isDark ? '#7dd3fc' : '#0ea5e9';
  const ringColor = isDark ? '#e2e8f0' : '#ffffff';
  const shadowColor = isDark ? '#0f172a55' : '#0f172a26';
  const labelTextColor = isDark ? '#e2e8f0' : '#0f172a';
  const labelBgColor = isDark ? '#0f172acc' : '#fffffff0';
  const labelStrokeColor = isDark ? '#7dd3fc66' : '#0ea5e950';
  const labelWidth = clamp(Math.ceil(estimateMarkerNameWidth(label, 11) + 22), 74, 176);
  const width = Math.max(32, labelWidth);
  const height = 56;
  const centerX = Math.round(width / 2);
  const pinTipY = 34;
  const labelX = Math.round((width - labelWidth) / 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <path d="M${centerX} 4C${centerX - 5.52} 4 ${centerX - 10} 8.48 ${centerX - 10} 14c0 6.76 5.42 11.86 9.27 18.34a.9.9 0 0 0 1.46 0C${centerX + 4.58} 25.86 ${centerX + 10} 20.76 ${centerX + 10} 14c0-5.52-4.48-10-10-10z" fill="${shadowColor}" transform="translate(0 1)" />
  <path d="M${centerX} 3C${centerX - 5.52} 3 ${centerX - 10} 7.48 ${centerX - 10} 13c0 6.76 5.42 11.86 9.27 18.34a.9.9 0 0 0 1.46 0C${centerX + 4.58} 24.86 ${centerX + 10} 19.76 ${centerX + 10} 13c0-5.52-4.48-10-10-10z" fill="${markerColor}" stroke="${ringColor}" stroke-width="1.4" />
  <circle cx="${centerX}" cy="13" r="4.2" fill="${ringColor}" fill-opacity="0.94" />
  <rect x="${labelX}" y="39" width="${labelWidth}" height="15" rx="7.5" fill="${shadowColor}" transform="translate(0 1)" />
  <rect x="${labelX}" y="38" width="${labelWidth}" height="15" rx="7.5" fill="${labelBgColor}" stroke="${labelStrokeColor}" stroke-width="1" />
  <text x="${centerX}" y="48.8" text-anchor="middle" fill="${labelTextColor}" font-family="PingFang SC, Microsoft YaHei, Arial, sans-serif" font-size="11" font-weight="600">${safeLabel}</text>
</svg>`;

  return {
    src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    width,
    height,
    anchorX: centerX,
    anchorY: pinTipY,
  };
};

const getLatestTencentStyleResourceId = (): string => {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return '';
  const entries = performance.getEntriesByType?.('resource') || [];
  const styleEntries = entries
    .map((entry) => String((entry as PerformanceResourceTiming).name || ''))
    .filter((url) => url.includes('vectorsdk.map.qq.com/fileupdate/jsapi/style'));
  const latestStyleEntry = styleEntries[styleEntries.length - 1];
  if (!latestStyleEntry) return '';

  try {
    const url = new URL(latestStyleEntry);
    return url.searchParams.get('id') || '';
  } catch {
    return '';
  }
};

const detectProvider = async (mode: ProviderMode): Promise<MapProvider> => {
  if (mode !== 'auto') return mode;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);
    const response = await fetch('https://ipapi.co/country/', {
      cache: 'no-store',
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (response.ok) {
      const country = (await response.text()).trim().toUpperCase();
      if (country === 'CN') return 'tencent';
      return 'apple';
    }
  } catch {
    // Fall through to locale-based heuristic.
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const language = navigator.language || '';
  if (timezone.startsWith('Asia/Shanghai') || language.toLowerCase().startsWith('zh-cn')) {
    return 'tencent';
  }
  return 'apple';
};

const loadMapKitScript = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持地图渲染。');
  }

  if (window.mapkit) return;
  if (mapKitScriptPromise) return mapKitScriptPromise;

  mapKitScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAPKIT_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.mapkit) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Apple MapKit JS 载入失败。')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = MAPKIT_SCRIPT_ID;
    script.src = MAPKIT_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Apple MapKit JS 载入失败。'));
    document.head.appendChild(script);
  });

  return mapKitScriptPromise;
};

const loadTencentScript = async (options: { apiKey?: string; serviceHost?: string }): Promise<void> => {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持地图渲染。');
  }

  const apiKey = String(options.apiKey || '').trim();
  const serviceHost = String(options.serviceHost || '').trim();
  const identity = serviceHost ? `proxy:${serviceHost}` : `key:${apiKey}`;

  if (window.TMap) return;
  if (tencentScriptPromise && tencentScriptIdentity === identity) return tencentScriptPromise;

  tencentScriptIdentity = identity;
  tencentScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TENCENT_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.TMap) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('腾讯地图 JS API 载入失败。')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TENCENT_SCRIPT_ID;
    if (serviceHost) {
      const normalizedHost = serviceHost.replace(/\/$/, '');
      window._TMapSecurityConfig = {
        ...(window._TMapSecurityConfig || {}),
        serviceHost: normalizedHost,
      };
      script.src = 'https://map.qq.com/api/gljs?v=1.exp';
    } else {
      script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(apiKey)}`;
    }
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('腾讯地图 JS API 载入失败。'));
    document.head.appendChild(script);
  });

  return tencentScriptPromise;
};

const GardensMapOverlay: React.FC<GardensMapOverlayProps> = ({ gardens, isDark, onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [provider, setProvider] = useState<MapProvider>('apple');
  const [providerReady, setProviderReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [tileWarning, setTileWarning] = useState('');
  const [selectedGarden, setSelectedGarden] = useState<Garden | null>(null);

  const coordinateDatum = parseCoordinateDatum(import.meta.env.VITE_COORDINATE_DATUM);
  const providerMode = parseProviderMode(import.meta.env.VITE_MAP_PROVIDER);
  const configuredStyleId = String(import.meta.env.VITE_TENCENT_MAP_STYLE_ID || '').trim();
  const configuredServiceHost = String(import.meta.env.VITE_TENCENT_MAP_SERVICE_HOST || '').trim();
  const styleId = parseTencentStyleId(import.meta.env.VITE_TENCENT_MAP_STYLE_ID);

  const mapPoints = useMemo(
    () =>
      gardens
        .map((garden, index) => {
          const parsed = parseCoordinateString(garden.location?.coordinates || '');
          if (!parsed) return null;

          const appleCoord = toWgs84(parsed, coordinateDatum);
          const tencentCoord = toGcj02(parsed, coordinateDatum);
          return {
            garden,
            index,
            appleLat: appleCoord.lat,
            appleLng: appleCoord.lng,
            tencentLat: tencentCoord.lat,
            tencentLng: tencentCoord.lng,
          };
        })
        .filter(Boolean) as GardenPoint[],
    [coordinateDatum, gardens]
  );

  useEffect(() => {
    let cancelled = false;
    const resolveProvider = async () => {
      const nextProvider = await detectProvider(providerMode);
      if (!cancelled) {
        setProvider(nextProvider);
        setSelectedGarden(null);
        setProviderReady(true);
      }
    };

    setProviderReady(false);
    resolveProvider();
    return () => {
      cancelled = true;
    };
  }, [providerMode]);

  useEffect(() => {
    let cancelled = false;

    const cleanupMap = () => {
      if (mapInstanceRef.current) {
        try {
          if (markersRef.current.length > 0) {
            if (provider === 'apple') {
              mapInstanceRef.current.removeAnnotations?.(markersRef.current);
            } else {
              markersRef.current.forEach((marker) => {
                marker?.off?.('click', marker?.__clickHandler);
                marker?.setMap?.(null);
              });
              mapInstanceRef.current.remove?.(markersRef.current);
            }
          }
          mapInstanceRef.current.destroy?.();
        } catch {
          // Ignore cleanup errors from third-party SDK
        }
      }
      mapInstanceRef.current = null;
      markersRef.current = [];
    };

    const setupAppleMap = async () => {
      const token = import.meta.env.VITE_APPLE_MAPKIT_JWT;
      if (!token) {
        throw new Error('未配置 Apple MapKit 令牌。请设置 VITE_APPLE_MAPKIT_JWT。');
      }

      await loadMapKitScript();
      const mapkit = window.mapkit;
      if (!mapkit) {
        throw new Error('Apple MapKit JS 未正确初始化。');
      }

      if (!mapkit.initialized) {
        mapkit.init({
          authorizationCallback: (done: (token: string) => void) => done(token),
          language: 'zh-CN',
        });
      }

      if (!mapContainerRef.current || cancelled) return;
      cleanupMap();

      const map = new mapkit.Map(mapContainerRef.current, {
        isRotationEnabled: false,
        isZoomEnabled: true,
        isScrollEnabled: true,
      });
      mapInstanceRef.current = map;
      map.addEventListener?.('error', (event: any) => {
        const code = event?.error?.code || event?.code || 'UNKNOWN';
        const detail = event?.error?.message || event?.message || '';
        setTileWarning(
          `底图资源加载异常（${code}${detail ? `: ${detail}` : ''}）。中国大陆网络下 Apple 底图可能不可达，通常会出现“只显示点位”。`
        );
      });

      const markers = mapPoints.map((point) => {
        return new mapkit.MarkerAnnotation(new mapkit.Coordinate(point.appleLat, point.appleLng), {
          title: point.garden.name,
          subtitle: point.garden.location.address || '地址不详',
          color: isDark ? '#7dd3fc' : '#0ea5e9',
        });
      });

      markersRef.current = markers;
      map.addAnnotations(markers);
      if (typeof map.showItems === 'function') {
        map.showItems(markers);
      }
    };

    const setupTencent = async () => {
      const apiKey = String(import.meta.env.VITE_TENCENT_MAP_KEY || '').trim();
      if (!configuredServiceHost && !apiKey) {
        throw new Error('未配置腾讯地图鉴权参数。请设置 VITE_TENCENT_MAP_SERVICE_HOST 或 VITE_TENCENT_MAP_KEY。');
      }

      await loadTencentScript({
        apiKey,
        serviceHost: configuredServiceHost,
      });
      const TMap = window.TMap;
      if (!TMap) {
        throw new Error('腾讯地图 JS API 未正确初始化。');
      }

      if (!mapContainerRef.current || cancelled) return;
      cleanupMap();

      const center = mapPoints[0]
        ? new TMap.LatLng(mapPoints[0].tencentLat, mapPoints[0].tencentLng)
        : new TMap.LatLng(31.3116, 120.6235);

      const mapOptions: Record<string, any> = {
        zoom: 11.8,
        center,
      };
      if (styleId) {
        mapOptions.mapStyleId = styleId;
      }
      const map = new TMap.Map(mapContainerRef.current, mapOptions);
      mapInstanceRef.current = map;
      if (styleId && typeof map.setMapStyleId === 'function') {
        map.setMapStyleId(styleId);
      }
      if (configuredStyleId && !styleId) {
        setTileWarning(
          `腾讯地图样式 ID "${configuredStyleId}" 格式无效。请使用 style数字（例如 style1），否则会回退默认样式。`
        );
      } else if (!configuredStyleId) {
        setTileWarning('未配置腾讯地图样式 ID，当前使用默认底图样式。');
      } else {
        window.setTimeout(() => {
          const resolvedStyleResourceId = getLatestTencentStyleResourceId();
          if (resolvedStyleResourceId === '0') {
            setTileWarning(
              `已请求样式 ${styleId}，但腾讯返回默认样式(id=0)。请到腾讯位置服务控制台将该样式绑定到当前 Key。`
            );
          }
        }, 1200);
      }

      const supportsMarkerStyle = typeof TMap.MarkerStyle === 'function';
      const styles = supportsMarkerStyle
        ? mapPoints.reduce((acc, point, index) => {
            const markerAsset = buildTencentMarkerAsset(point.garden.name, isDark);
            acc[`apple-marker-style-${index}`] = new TMap.MarkerStyle({
              width: markerAsset.width,
              height: markerAsset.height,
              anchor: { x: markerAsset.anchorX, y: markerAsset.anchorY },
              src: markerAsset.src,
            });
            return acc;
          }, {} as Record<string, any>)
        : undefined;

      const geometries = mapPoints.map((point, index) => ({
        id: `garden-${index}`,
        styleId: supportsMarkerStyle ? `apple-marker-style-${index}` : undefined,
        position: new TMap.LatLng(point.tencentLat, point.tencentLng),
        properties: {
          title: point.garden.name,
        },
      }));

      const markerOptions: Record<string, any> = {
        id: 'garden-marker-layer',
        map,
        geometries,
      };
      if (supportsMarkerStyle) {
        markerOptions.styles = styles;
      }
      const markerLayer = new TMap.MultiMarker(markerOptions);

      const clickHandler = (evt: any) => {
        const geometryId = evt?.geometry?.id;
        if (!geometryId) return;

        const hit = mapPoints.find((point, index) => `garden-${index}` === geometryId);
        if (hit) {
          setSelectedGarden(hit.garden);
        }
      };
      markerLayer.on?.('click', clickHandler);
      (markerLayer as any).__clickHandler = clickHandler;

      markersRef.current = [markerLayer];
      if (mapPoints.length > 1) {
        const avgLat = mapPoints.reduce((sum, item) => sum + item.tencentLat, 0) / mapPoints.length;
        const avgLng = mapPoints.reduce((sum, item) => sum + item.tencentLng, 0) / mapPoints.length;
        map.setCenter?.(new TMap.LatLng(avgLat, avgLng));
      }
    };

    const setupMap = async () => {
      if (!providerReady) {
        setIsLoading(true);
        return;
      }

      if (mapPoints.length === 0) {
        setErrorMessage('暂无可用于地图展示的园林坐标。');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      setTileWarning('');

      try {
        if (provider === 'tencent') {
          await setupTencent();
        } else {
          await setupAppleMap();
        }
        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '地图初始化失败。';
          setErrorMessage(message);
          setIsLoading(false);
        }
      }
    };

    setupMap();

    return () => {
      cancelled = true;
      cleanupMap();
    };
  }, [isDark, mapPoints, provider, providerReady]);

  const providerLabel = providerReady
    ? provider === 'tencent'
      ? `腾讯地图${configuredServiceHost ? ' · 签名代理' : ''}${configuredStyleId ? ` · 样式 ${configuredStyleId}` : ' · 默认样式'}`
      : 'Apple MapKit JS'
    : '地图服务检测中...';
  const selectedStatusMeta = selectedGarden ? getGardenStatusMeta(selectedGarden.status) : null;
  const selectedInfoCardBottomOffset = 'calc(env(safe-area-inset-bottom, 0px) + 96px)';

  return (
    <div className={`fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300 ${isDark ? 'bg-black/90' : 'bg-white/95'}`}>
      <div className="flex justify-between items-center p-6 pt-safe-top mt-4 pointer-events-auto">
        <div>
          <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>园林地图</div>
          <div className={`text-xs mt-1 flex items-center gap-2 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            <MapPin className="w-3.5 h-3.5" />
            <span>共 {mapPoints.length} 个可定位园林</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-full transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'}`}
          aria-label="关闭地图"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-safe-bottom pointer-events-auto">
        <div className="max-w-5xl mx-auto h-full pb-10">
          <div className={`relative h-full rounded-2xl border overflow-hidden backdrop-blur-md ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'}`}>
            <div className={`px-4 py-3 text-xs font-medium border-b ${isDark ? 'text-white/60 border-white/10' : 'text-gray-500 border-black/10'}`}>
              {providerLabel}
            </div>
            <div className="relative w-full h-[calc(100%-41px)] min-h-[360px]">
              <div ref={mapContainerRef} className="absolute inset-0" />

              {isLoading && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-black/30 text-white/80' : 'bg-white/60 text-gray-700'}`}>
                  <div className={`w-8 h-8 rounded-full border-2 border-transparent animate-spin ${isDark ? 'border-t-white border-r-white/40' : 'border-t-gray-700 border-r-gray-400'}`} />
                  <span className="text-sm">地图加载中...</span>
                </div>
              )}

              {errorMessage && !isLoading && (
                <div className={`absolute inset-0 flex items-center justify-center p-6 ${isDark ? 'bg-black/50' : 'bg-white/75'}`}>
                  <div className={`max-w-md rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${isDark ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {tileWarning && !errorMessage && !isLoading && (
                <div className="absolute right-3 top-3 z-10 w-[min(560px,calc(100%-24px))]">
                  <div className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${isDark ? 'border-amber-400/30 bg-amber-500/15 text-amber-100' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{tileWarning}</span>
                  </div>
                </div>
              )}

              {provider === 'tencent' && selectedGarden && (
                <div
                  className="absolute left-3 z-20 w-[min(360px,calc(100%-24px))] pointer-events-auto"
                  style={{ bottom: selectedInfoCardBottomOffset }}
                >
                  <div className={`rounded-2xl border backdrop-blur-md shadow-xl p-4 flex flex-col ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-white/90 border-black/10 text-gray-900'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold leading-tight">{selectedGarden.name}</div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>{selectedGarden.location.address || '地址不详'}</div>
                      </div>
                      <button
                        onClick={() => setSelectedGarden(null)}
                        className={`shrink-0 text-xs px-2 py-1 rounded-full ${isDark ? 'bg-white/15 hover:bg-white/25' : 'bg-black/5 hover:bg-black/10'}`}
                      >
                        关闭
                      </button>
                    </div>
                    <div className={`text-xs mt-3 max-h-[32vh] overflow-y-auto pr-1 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                      {selectedGarden.description}
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)' }}>
                      {selectedStatusMeta && (
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border"
                          style={{
                            borderColor: hexToRgba(selectedStatusMeta.dotColor, isDark ? 0.45 : 0.3),
                            backgroundColor: hexToRgba(selectedStatusMeta.dotColor, isDark ? 0.18 : 0.12),
                            color: isDark ? '#f8fafc' : '#1f2937',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: selectedStatusMeta.dotColor,
                            }}
                          />
                          {selectedStatusMeta.label}
                        </span>
                      )}
                      <span className={`text-[11px] ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{selectedGarden.year}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GardensMapOverlay;
