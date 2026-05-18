'use client';

import { Alert, Button, Empty, Input, List, Space, Tag, Typography } from 'antd';
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';
import type { CemeteryLocationFields } from '@/lib/types';
import {
  type AMapAutoCompleteInstance,
  type AMapAutoCompleteTip,
  hasAmapKey,
  loadAmap,
  type AMapConstructor,
  type AMapCitySearchInstance,
  type AMapMapInstance,
  type AMapMarkerInstance,
  type AMapPoiSearchResult,
  type AMapPlaceSearchInstance,
} from '@/lib/amap';

const { Paragraph, Text } = Typography;
const MIN_POI_SEARCH_LENGTH = 2;
const PRECISE_LOCATION_ZOOM = 17;
const CURRENT_LOCATION_ZOOM = 16;
const CITY_LOCATION_ZOOM = 12;
const DEFAULT_LOCATION_ZOOM = 11;

type CemeteryPoiOption = {
  id: string | null;
  name: string;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
};

type CemeteryMapPickerProps = {
  value?: Partial<CemeteryLocationFields> | null;
  onChange?: (value: CemeteryLocationFields) => void;
  disabled?: boolean;
};

const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];

type ResolvedMapCenter = {
  center: [number, number];
  zoom: number;
  geolocationNotice?: {
    level: 'info' | 'warning';
    message: string;
  } | null;
};

type BrowserGeolocationResult =
  | {
      status: 'success';
      coords: [number, number];
    }
  | {
      status: 'unsupported' | 'insecure-context' | 'permission-denied' | 'position-unavailable' | 'timeout' | 'failed';
    };

function normalizeValue(value?: Partial<CemeteryLocationFields> | null): CemeteryLocationFields {
  return {
    cemeteryLatitude: value?.cemeteryLatitude ?? null,
    cemeteryLongitude: value?.cemeteryLongitude ?? null,
    cemeteryName: value?.cemeteryName ?? null,
    cemeteryAddress: value?.cemeteryAddress ?? null,
    cemeteryPoiId: value?.cemeteryPoiId ?? null,
    cemeteryRemark: value?.cemeteryRemark ?? null,
  };
}

function buildAddressText(poi: AMapPoiSearchResult) {
  return [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join(' ');
}

function buildTipAddressText(tip: AMapAutoCompleteTip) {
  return [tip.district, tip.address].filter(Boolean).join(' ');
}

function normalizeTipOption(tip: AMapAutoCompleteTip): CemeteryPoiOption | null {
  const name = tip.name?.trim();
  if (!name) {
    return null;
  }

  const coordinates = getCoordinates(tip);
  return {
    id: tip.id ?? null,
    name,
    address: buildTipAddressText(tip) || null,
    longitude: coordinates?.lng ?? null,
    latitude: coordinates?.lat ?? null,
  };
}

function normalizePlaceSearchOption(poi: AMapPoiSearchResult): CemeteryPoiOption | null {
  const name = poi.name?.trim();
  if (!name) {
    return null;
  }

  const coordinates = getCoordinates(poi);
  return {
    id: poi.id ?? null,
    name,
    address: buildAddressText(poi) || null,
    longitude: coordinates?.lng ?? null,
    latitude: coordinates?.lat ?? null,
  };
}

function mergePoiOptions(options: CemeteryPoiOption[]) {
  const uniqueOptions = new Map<string, CemeteryPoiOption>();

  options.forEach((option) => {
    const key =
      option.id ??
      `${option.name}::${option.address ?? ''}::${option.longitude ?? 'x'}::${option.latitude ?? 'y'}`;
    if (!uniqueOptions.has(key)) {
      uniqueOptions.set(key, option);
    }
  });

  return Array.from(uniqueOptions.values());
}

function getCoordinates(
  point: {
    location?: {
      lng?: number;
      lat?: number;
      getLng?: () => number;
      getLat?: () => number;
    };
  },
) {
  const lng = point.location?.lng ?? point.location?.getLng?.();
  const lat = point.location?.lat ?? point.location?.getLat?.();
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    return null;
  }

  return { lng, lat };
}

async function resolveBrowserGeolocation(): Promise<BrowserGeolocationResult> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return { status: 'unsupported' };
  }

  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    return { status: 'insecure-context' };
  }

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
    };
  };

  const getCurrentPosition = (options: PositionOptions) =>
    new Promise<BrowserGeolocationResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            status: 'success',
            coords: [position.coords.longitude, position.coords.latitude],
          });
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              resolve({ status: 'permission-denied' });
              return;
            case error.POSITION_UNAVAILABLE:
              resolve({ status: 'position-unavailable' });
              return;
            case error.TIMEOUT:
              resolve({ status: 'timeout' });
              return;
            default:
              resolve({ status: 'failed' });
          }
        },
        options,
      );
    });

  const isMobileLikeDevice =
    navigatorWithUserAgentData.userAgentData?.mobile === true ||
    window.matchMedia?.('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (isMobileLikeDevice) {
    const preciseLocation = await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
    if (preciseLocation.status === 'success') {
      return preciseLocation;
    }
  }

  return getCurrentPosition({
    enableHighAccuracy: false,
    timeout: 6000,
    maximumAge: 300000,
  });
}

async function resolveCityCenter(amap: AMapConstructor): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    const citySearch = new amap.CitySearch() as AMapCitySearchInstance;
    citySearch.getLocalCity((status, result) => {
      if (status !== 'complete') {
        resolve(null);
        return;
      }

      const center = result.bounds?.getCenter?.();
      const lng = center?.getLng?.();
      const lat = center?.getLat?.();
      if (typeof lng === 'number' && typeof lat === 'number') {
        resolve([lng, lat]);
        return;
      }

      resolve(null);
    });
  });
}

async function resolveInitialMapCenter(
  amap: AMapConstructor,
  value: CemeteryLocationFields,
): Promise<ResolvedMapCenter> {
  if (value.cemeteryLongitude !== null && value.cemeteryLatitude !== null) {
    return {
      center: [value.cemeteryLongitude, value.cemeteryLatitude],
      zoom: PRECISE_LOCATION_ZOOM,
      geolocationNotice: null,
    };
  }

  const browserLocation = await resolveBrowserGeolocation();
  if (browserLocation.status === 'insecure-context') {
    console.warn(
      '[CemeteryMapPicker] 当前页面不是安全环境，浏览器已拒绝 GPS 定位。手机端请尽量通过 HTTPS 域名访问；局域网 HTTP 地址通常无法获取精准定位。',
    );
  }

  if (browserLocation.status === 'success') {
    return {
      center: browserLocation.coords,
      zoom: CURRENT_LOCATION_ZOOM,
      geolocationNotice: {
        level: 'info',
        message: '已按当前设备定位初始化地图中心，可直接在附近选点或微调标记。',
      },
    };
  }

  const cityCenter = await resolveCityCenter(amap);
  if (cityCenter) {
    const geolocationNotice =
      browserLocation.status === 'insecure-context'
        ? {
            level: 'warning' as const,
            message: '当前页面无法获取设备精准定位，地图已回退到城市范围。',
          }
        : browserLocation.status === 'permission-denied'
          ? {
              level: 'warning' as const,
              message: '浏览器定位权限被拒绝，地图已回退到城市范围。可在系统或浏览器设置中允许定位后重试。',
            }
          : browserLocation.status === 'unsupported'
            ? {
                level: 'warning' as const,
                message: '当前浏览器环境不支持定位，地图已回退到城市范围。',
              }
            : browserLocation.status === 'position-unavailable'
              ? {
                  level: 'warning' as const,
                  message: '暂时无法获取当前设备位置，地图已回退到城市范围。',
                }
              : browserLocation.status === 'timeout'
                ? {
                    level: 'warning' as const,
                    message: '获取当前设备位置超时，地图已回退到城市范围。请检查网络或定位服务后重试。',
                  }
                : browserLocation.status === 'failed'
                  ? {
                      level: 'warning' as const,
                      message: '当前设备定位初始化失败，地图已回退到城市范围。',
                    }
                  : null;

    return {
      center: cityCenter,
      zoom: CITY_LOCATION_ZOOM,
      geolocationNotice,
    };
  }

  const geolocationNotice =
    browserLocation.status === 'insecure-context'
      ? {
          level: 'warning' as const,
          message: '当前页面无法获取设备精准定位，地图已使用默认中心点。',
        }
      : browserLocation.status === 'permission-denied'
        ? {
            level: 'warning' as const,
            message: '浏览器定位权限被拒绝，地图已使用默认中心点。可在系统或浏览器设置中允许定位后重试。',
          }
        : browserLocation.status === 'unsupported'
          ? {
              level: 'warning' as const,
              message: '当前浏览器环境不支持定位，地图已使用默认中心点。',
            }
          : browserLocation.status === 'position-unavailable'
            ? {
                level: 'warning' as const,
                message: '暂时无法获取当前设备位置，地图已使用默认中心点。',
              }
            : browserLocation.status === 'timeout'
              ? {
                  level: 'warning' as const,
                  message: '获取当前设备位置超时，地图已使用默认中心点。',
                }
              : browserLocation.status === 'failed'
                ? {
                    level: 'warning' as const,
                    message: '当前设备定位初始化失败，地图已使用默认中心点。',
                  }
                : null;

  return {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_LOCATION_ZOOM,
    geolocationNotice,
  };
}

export function CemeteryMapPicker({ value, onChange, disabled = false }: CemeteryMapPickerProps) {
  const normalizedValue = useMemo(() => normalizeValue(value), [value]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AMapMapInstance | null>(null);
  const markerRef = useRef<AMapMarkerInstance | null>(null);
  const autoCompleteRef = useRef<AMapAutoCompleteInstance | null>(null);
  const placeSearchRef = useRef<AMapPlaceSearchInstance | null>(null);
  const dragHandlerRef = useRef<((...args: unknown[]) => void) | null>(null);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(normalizedValue);
  const composingRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CemeteryPoiOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geolocationNotice, setGeolocationNotice] = useState<ResolvedMapCenter['geolocationNotice']>(null);
  const [searchReady, setSearchReady] = useState(false);
  const deferredSearchKeyword = useDeferredValue(searchKeyword);
  const hasCoordinates =
    normalizedValue.cemeteryLatitude !== null && normalizedValue.cemeteryLongitude !== null;
  const coordinateText = hasCoordinates
    ? `${normalizedValue.cemeteryLatitude?.toFixed(6)}, ${normalizedValue.cemeteryLongitude?.toFixed(6)}`
    : null;
  const locationModeLabel = !hasCoordinates
    ? '未定位'
    : normalizedValue.cemeteryPoiId
      ? 'POI 选点'
      : '手动点位';

  const emitChange = (nextValue: Partial<CemeteryLocationFields>) => {
    onChange?.(normalizeValue({ ...normalizedValue, ...nextValue }));
  };

  const syncMarker = useEffectEvent((amap: AMapConstructor, lng: number | null, lat: number | null) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (lng === null || lat === null) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      const marker = new amap.Marker({
        position: [lng, lat],
        draggable: !disabledRef.current,
      });
      marker.setMap(map);
      const handleDragEnd = (...args: unknown[]) => {
        const event = args[0] as { lnglat?: { getLng?: () => number; getLat?: () => number } };
        const draggedLng = event.lnglat?.getLng?.();
        const draggedLat = event.lnglat?.getLat?.();
        if (typeof draggedLng !== 'number' || typeof draggedLat !== 'number') {
          return;
        }
        onChangeRef.current?.(
          normalizeValue({
            ...valueRef.current,
            cemeteryLongitude: draggedLng,
            cemeteryLatitude: draggedLat,
            cemeteryPoiId: null,
            cemeteryAddress: null,
          }),
        );
      };
      marker.on('dragend', handleDragEnd);
      dragHandlerRef.current = handleDragEnd;
      markerRef.current = marker;
    } else {
      markerRef.current.setPosition([lng, lat]);
      markerRef.current.setDraggable?.(!disabledRef.current);
    }

    map.setCenter([lng, lat]);
    map.setZoom?.(PRECISE_LOCATION_ZOOM);
  });

  useEffect(() => {
    disabledRef.current = disabled;
    markerRef.current?.setDraggable?.(!disabled);
  }, [disabled]);

  useEffect(() => {
    valueRef.current = normalizedValue;
  }, [normalizedValue]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (searchKeyword.trim()) {
      return;
    }

    if (normalizedValue.cemeteryPoiId && normalizedValue.cemeteryName) {
      setSearchKeyword(normalizedValue.cemeteryName);
    }
  }, [normalizedValue.cemeteryName, normalizedValue.cemeteryPoiId, searchKeyword]);

  useEffect(() => {
    if (!hasAmapKey()) {
      return;
    }
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    let destroyed = false;

    void loadAmap()
      .then(async (amap) => {
        if (destroyed || !mapContainerRef.current) {
          return;
        }

        const resolvedCenter = await resolveInitialMapCenter(amap, valueRef.current);
        setGeolocationNotice(resolvedCenter.geolocationNotice ?? null);
        const initialLng = resolvedCenter.center[0];
        const initialLat = resolvedCenter.center[1];
        const map = new amap.Map(mapContainerRef.current, {
          zoom: resolvedCenter.zoom,
          center: [initialLng, initialLat],
          resizeEnable: true,
        });
        map.addControl(new amap.Scale());
        if (!disabledRef.current) {
          map.addControl(new amap.ToolBar({ position: { right: '12px', bottom: '18px' } }));
        }
        map.on('click', (...args: unknown[]) => {
          if (disabledRef.current) {
            return;
          }
          const event = args[0] as { lnglat?: { getLng?: () => number; getLat?: () => number } };
          const lng = event.lnglat?.getLng?.();
          const lat = event.lnglat?.getLat?.();
          if (typeof lng !== 'number' || typeof lat !== 'number') {
            return;
          }
          onChangeRef.current?.(
            normalizeValue({
              ...valueRef.current,
              cemeteryLongitude: lng,
              cemeteryLatitude: lat,
              cemeteryPoiId: null,
              cemeteryAddress: null,
            }),
          );
        });

        mapRef.current = map;
        autoCompleteRef.current = new amap.AutoComplete({
          datatype: 'poi',
          citylimit: false,
        });
        placeSearchRef.current = new amap.PlaceSearch({
          pageSize: 8,
          pageIndex: 1,
        });
        setSearchReady(true);
        syncMarker(amap, valueRef.current.cemeteryLongitude, valueRef.current.cemeteryLatitude);
      })
      .catch((error: unknown) => {
        if (!destroyed) {
          setLoadError(error instanceof Error ? error.message : '高德地图加载失败。');
        }
      });

    return () => {
      destroyed = true;
      if (markerRef.current && dragHandlerRef.current) {
        markerRef.current.off?.('dragend', dragHandlerRef.current);
      }
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
      autoCompleteRef.current = null;
      placeSearchRef.current = null;
      setGeolocationNotice(null);
      setSearchReady(false);
    };
  }, []);

  useEffect(() => {
    if (!hasAmapKey()) {
      return;
    }
    if (!window.AMap) {
      return;
    }
    syncMarker(window.AMap, normalizedValue.cemeteryLongitude, normalizedValue.cemeteryLatitude);
  }, [disabled, normalizedValue.cemeteryLatitude, normalizedValue.cemeteryLongitude]);

  const searchAutoComplete = useEffectEvent(
    async (keyword: string): Promise<CemeteryPoiOption[]> =>
      new Promise((resolve) => {
        if (!autoCompleteRef.current) {
          resolve([]);
          return;
        }

        autoCompleteRef.current.search(keyword, (status, result) => {
          if (status !== 'complete') {
            resolve([]);
            return;
          }

          resolve(
            mergePoiOptions((result.tips ?? []).map(normalizeTipOption).filter((tip): tip is CemeteryPoiOption => !!tip)),
          );
        });
      }),
  );

  const searchPlace = useEffectEvent(
    async (keyword: string): Promise<CemeteryPoiOption[]> =>
      new Promise((resolve) => {
        if (!placeSearchRef.current) {
          resolve([]);
          return;
        }

        placeSearchRef.current.search(keyword, (status, result) => {
          if (status !== 'complete') {
            resolve([]);
            return;
          }

          resolve(
            mergePoiOptions(
              (result.poiList?.pois ?? [])
                .map(normalizePlaceSearchOption)
                .filter((poi): poi is CemeteryPoiOption => !!poi),
            ),
          );
        });
      }),
  );

  useEffect(() => {
    if (disabled) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (composingRef.current) {
      return;
    }

    const keyword = deferredSearchKeyword.trim();
    if (!keyword || keyword.length < MIN_POI_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (!searchReady || !autoCompleteRef.current) {
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    const timer = window.setTimeout(() => {
      if (!searchReady || !autoCompleteRef.current) {
        return;
      }

      setSearching(true);
      void (async () => {
        const autoCompleteResults = await searchAutoComplete(keyword);
        const nextResults = autoCompleteResults.length > 0 ? autoCompleteResults : await searchPlace(keyword);

        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        setSearchResults(nextResults);
        setSearching(false);
      })();
    }, 320);

    return () => {
      window.clearTimeout(timer);
      if (searchRequestIdRef.current === requestId) {
        setSearching(false);
      }
    };
  }, [deferredSearchKeyword, disabled, searchReady]);

  const handleSelectPoi = (option: CemeteryPoiOption) => {
    if (option.name) {
      setSearchKeyword(option.name);
    }

    if (option.longitude !== null && option.latitude !== null) {
      emitChange({
        cemeteryLongitude: option.longitude,
        cemeteryLatitude: option.latitude,
        cemeteryPoiId: option.id,
        cemeteryName: option.name || normalizedValue.cemeteryName,
        cemeteryAddress: option.address,
      });
      return;
    }

    if (!placeSearchRef.current || !option.name) {
      emitChange({
        cemeteryPoiId: option.id,
        cemeteryName: option.name || normalizedValue.cemeteryName,
        cemeteryAddress: option.address,
      });
      return;
    }

    setSearching(true);
    placeSearchRef.current.search(option.name, (status, result) => {
      setSearching(false);
      const firstPoi = status === 'complete' ? result.poiList?.pois?.[0] : undefined;
      const poiCoordinates = firstPoi ? getCoordinates(firstPoi) : null;

      emitChange({
        cemeteryLongitude: poiCoordinates?.lng ?? normalizedValue.cemeteryLongitude,
        cemeteryLatitude: poiCoordinates?.lat ?? normalizedValue.cemeteryLatitude,
        cemeteryPoiId: firstPoi?.id ?? option.id ?? null,
        cemeteryName: firstPoi?.name ?? option.name ?? normalizedValue.cemeteryName,
        cemeteryAddress: (firstPoi ? buildAddressText(firstPoi) : option.address) || null,
      });
    });
  };

  const handleKeywordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(event.target.value);
  };

  const handleCompositionStart = (_event: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = true;
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    setSearchKeyword(event.currentTarget.value);
  };

  if (!hasAmapKey()) {
    return (
      <Alert
        type="warning"
        showIcon
        message="未配置高德地图 Key"
        description="请先在环境变量中配置 NEXT_PUBLIC_AMAP_KEY，随后即可使用 POI 搜索和地图打点。"
      />
    );
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {loadError ? <Alert type="error" showIcon message={loadError} /> : null}
      {geolocationNotice ? (
        <Alert type={geolocationNotice.level} showIcon message={geolocationNotice.message} />
      ) : null}
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        支持先搜索 POI 再选点，也支持直接点击地图或拖拽标记手动定位墓地位置。
      </Paragraph>
      <div className="cemetery-picker-status">
        <div className="cemetery-picker-status-main">
          <Text strong>当前位置状态</Text>
          <Space wrap size={[8, 8]}>
            <Tag color={!hasCoordinates ? 'default' : normalizedValue.cemeteryPoiId ? 'processing' : 'gold'}>
              {locationModeLabel}
            </Tag>
            <Tag color={hasCoordinates ? 'success' : 'default'}>
              {hasCoordinates ? '已保存有效坐标' : '尚未选择地图位置'}
            </Tag>
          </Space>
        </div>
        <Text type="secondary">
          {coordinateText ?? '请先搜索 POI 或在地图上点击确定墓地位置。'}
        </Text>
      </div>
      <div>
        <Input
          value={searchKeyword}
          disabled={disabled}
          placeholder="搜索墓园、陵园、公墓或具体地名，输入后会自动检索 POI"
          suffix={
            <span
              aria-live="polite"
              style={{
                display: 'inline-block',
                minWidth: '4.5em',
                textAlign: 'right',
                visibility: searching ? 'visible' : 'hidden',
              }}
            >
              搜索中…
            </span>
          }
          onChange={handleKeywordChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
        <List
          bordered
          size="small"
          className="cemetery-search-list"
          locale={{
            emptyText: searchKeyword.trim() ? (
              searchKeyword.trim().length < MIN_POI_SEARCH_LENGTH ? (
                `至少输入 ${MIN_POI_SEARCH_LENGTH} 个字符后开始检索`
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={4}>
                      <span>暂无 POI 结果</span>
                      <Text type="secondary">
                        可以尝试换个关键词，或直接在下方地图点击 / 拖拽标记手动打点。
                      </Text>
                    </Space>
                  }
                />
              )
            ) : (
              '输入关键词后会在此自动列出匹配 POI'
            ),
          }}
          dataSource={searchResults}
          renderItem={(poi) => {
            const isSelected = Boolean(
              (normalizedValue.cemeteryPoiId && poi.id && normalizedValue.cemeteryPoiId === poi.id) ||
                (poi.latitude !== null &&
                  poi.longitude !== null &&
                  normalizedValue.cemeteryLatitude !== null &&
                  normalizedValue.cemeteryLongitude !== null &&
                  Math.abs(normalizedValue.cemeteryLatitude - poi.latitude) < 0.000001 &&
                  Math.abs(normalizedValue.cemeteryLongitude - poi.longitude) < 0.000001),
            );

            return (
              <List.Item
                className={`cemetery-search-item${isSelected ? ' cemetery-search-item-active' : ''}`}
                actions={[
                  isSelected ? (
                    <Tag key={poi.id ?? poi.name ?? 'selected'} color="success">
                      已选中
                    </Tag>
                  ) : (
                    <Button
                      key={poi.id ?? poi.name}
                      size="small"
                      type="link"
                      onClick={() => handleSelectPoi(poi)}
                    >
                      选用
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap size={[8, 8]}>
                      <span>{poi.name ?? '未命名 POI'}</span>
                      {isSelected ? <Tag color="processing">当前选中</Tag> : null}
                    </Space>
                  }
                  description={poi.address || '暂无地址信息'}
                />
              </List.Item>
            );
          }}
        />
      </div>
      <div ref={mapContainerRef} className="cemetery-map-canvas" />
      <div className="cemetery-map-meta-grid">
        <div>
          <Text strong>墓地名称</Text>
          <Input
            value={normalizedValue.cemeteryName ?? ''}
            disabled={disabled}
            placeholder="手动打点后可填写墓地名称"
            onChange={(event) =>
              emitChange({
                cemeteryName: event.target.value.trim() || null,
              })
            }
          />
        </div>
        <div>
          <Text strong>POI / 地址</Text>
          <Input value={normalizedValue.cemeteryAddress ?? ''} disabled placeholder="POI 搜索选点后自动带出" />
        </div>
      </div>
      <div>
        <Text strong>备注</Text>
        <Input.TextArea
          value={normalizedValue.cemeteryRemark ?? ''}
          disabled={disabled}
          rows={3}
          placeholder="可补充碑位、区号、排号或其他说明"
          onChange={(event) =>
            emitChange({
              cemeteryRemark: event.target.value.trim() || null,
            })
          }
        />
      </div>
    </Space>
  );
}
