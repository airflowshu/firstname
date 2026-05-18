'use client';

export type AMapConstructor = {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => AMapMapInstance;
  Marker: new (options?: Record<string, unknown>) => AMapMarkerInstance;
  Scale: new (options?: Record<string, unknown>) => unknown;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
  AutoComplete: new (options?: Record<string, unknown>) => AMapAutoCompleteInstance;
  PlaceSearch: new (options?: Record<string, unknown>) => AMapPlaceSearchInstance;
  CitySearch: new (options?: Record<string, unknown>) => AMapCitySearchInstance;
  Pixel: new (x: number, y: number) => unknown;
  WebService?: {
    get: (
      path: string,
      params: Record<string, string>,
      callback: (status: string, data: unknown) => void,
      opts?: Record<string, unknown>,
    ) => void;
  };
};

export type AMapMapInstance = {
  add: (item: unknown) => void;
  addControl: (control: unknown) => void;
  clearMap: () => void;
  destroy: () => void;
  off?: (eventName: string, handler: (...args: unknown[]) => void) => void;
  on: (eventName: string, handler: (...args: unknown[]) => void) => void;
  remove: (item: unknown) => void;
  setCenter: (position: [number, number]) => void;
  setFitView?: (items?: unknown[]) => void;
  setZoom?: (zoom: number) => void;
};

export type AMapMarkerInstance = {
  destroy?: () => void;
  getPosition?: () => { getLng: () => number; getLat: () => number };
  off?: (eventName: string, handler: (...args: unknown[]) => void) => void;
  on: (eventName: string, handler: (...args: unknown[]) => void) => void;
  setDraggable?: (value: boolean) => void;
  setMap: (map: AMapMapInstance | null) => void;
  setPosition: (position: [number, number]) => void;
};

export type AMapPlaceSearchInstance = {
  search: (
    keyword: string,
    callback: (
      status: 'complete' | 'error' | 'no_data',
      result: { poiList?: { pois?: AMapPoiSearchResult[] } },
    ) => void,
  ) => void;
};

export type AMapPoiSearchResult = {
  id?: string;
  name?: string;
  address?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
  location?: {
    lng?: number;
    lat?: number;
    getLng?: () => number;
    getLat?: () => number;
  };
};

export type AMapAutoCompleteTip = {
  id?: string;
  name?: string;
  address?: string;
  district?: string;
  adcode?: string;
  location?: {
    lng?: number;
    lat?: number;
    getLng?: () => number;
    getLat?: () => number;
  };
};

export type AMapAutoCompleteInstance = {
  search: (
    keyword: string,
    callback: (
      status: 'complete' | 'error' | 'no_data',
      result: { tips?: AMapAutoCompleteTip[] },
    ) => void,
  ) => void;
};

export type AMapCitySearchInstance = {
  getLocalCity: (
    callback: (
      status: 'complete' | 'error' | 'no_data',
      result: {
        city?: string;
        province?: string;
        bounds?: {
          getCenter?: () => {
            getLng?: () => number;
            getLat?: () => number;
          };
        };
      },
    ) => void,
  ) => void;
};

declare global {
  interface Window {
    AMap?: AMapConstructor;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
    __fisrtnameAmapPromise?: Promise<AMapConstructor>;
  }
}

function getAmapKey() {
  return process.env.NEXT_PUBLIC_AMAP_KEY?.trim() ?? '';
}

function getAmapSecurityCode() {
  return process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE?.trim() ?? '';
}

export function hasAmapKey() {
  return getAmapKey().length > 0;
}

export async function loadAmap() {
  if (typeof window === 'undefined') {
    throw new Error('高德地图仅支持在浏览器环境中加载。');
  }

  const key = getAmapKey();
  if (!key) {
    throw new Error('未配置 NEXT_PUBLIC_AMAP_KEY，无法加载高德地图。');
  }

  if (window.AMap) {
    return window.AMap;
  }

  if (window.__fisrtnameAmapPromise) {
    return window.__fisrtnameAmapPromise;
  }

  const securityJsCode = getAmapSecurityCode();
  if (securityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode,
    };
  }

  window.__fisrtnameAmapPromise = new Promise<AMapConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      key,
    )}&plugin=AMap.Scale,AMap.ToolBar,AMap.AutoComplete,AMap.PlaceSearch,AMap.CitySearch`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
        return;
      }
      reject(new Error('高德地图脚本已加载，但全局对象未初始化。'));
    };
    script.onerror = () => {
      reject(new Error('高德地图脚本加载失败，请检查网络或 Key 配置。'));
    };
    document.head.appendChild(script);
  });

  return window.__fisrtnameAmapPromise;
}
