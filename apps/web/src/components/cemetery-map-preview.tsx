'use client';

import { Alert, Card, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CemeteryLocationFields } from '@/lib/types';
import {
  hasAmapKey,
  loadAmap,
  type AMapConstructor,
  type AMapMapInstance,
  type AMapMarkerInstance,
} from '@/lib/amap';

const { Paragraph, Text } = Typography;

type CemeteryMapPreviewProps = {
  value: Partial<CemeteryLocationFields>;
};

function normalizeValue(value: Partial<CemeteryLocationFields>) {
  return {
    cemeteryLatitude: value.cemeteryLatitude ?? null,
    cemeteryLongitude: value.cemeteryLongitude ?? null,
    cemeteryName: value.cemeteryName ?? null,
    cemeteryAddress: value.cemeteryAddress ?? null,
    cemeteryPoiId: value.cemeteryPoiId ?? null,
    cemeteryRemark: value.cemeteryRemark ?? null,
  };
}

export function CemeteryMapPreview({ value }: CemeteryMapPreviewProps) {
  const normalizedValue = useMemo(() => normalizeValue(value), [value]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AMapMapInstance | null>(null);
  const markerRef = useRef<AMapMarkerInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasCoordinates =
    normalizedValue.cemeteryLatitude !== null && normalizedValue.cemeteryLongitude !== null;
  const hasInfo = Boolean(
    hasCoordinates ||
      normalizedValue.cemeteryName ||
      normalizedValue.cemeteryAddress ||
      normalizedValue.cemeteryPoiId ||
      normalizedValue.cemeteryRemark,
  );

  useEffect(() => {
    if (!hasAmapKey()) {
      return;
    }
    if (!mapContainerRef.current) {
      return;
    }

    let destroyed = false;

    void loadAmap()
      .then((amap: AMapConstructor) => {
        if (destroyed || !mapContainerRef.current) {
          return;
        }

        const lng = normalizedValue.cemeteryLongitude;
        const lat = normalizedValue.cemeteryLatitude;
        if (lng === null || lat === null) {
          return;
        }

        const map = new amap.Map(mapContainerRef.current, {
          center: [lng, lat],
          zoom: 15,
          resizeEnable: true,
          dragEnable: true,
          zoomEnable: true,
        });
        map.addControl(new amap.Scale());
        const marker = new amap.Marker({
          position: [lng, lat],
        });
        marker.setMap(map);

        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch((error: unknown) => {
        if (!destroyed) {
          setLoadError(error instanceof Error ? error.message : '高德地图加载失败。');
        }
      });

    return () => {
      destroyed = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [normalizedValue.cemeteryLatitude, normalizedValue.cemeteryLongitude]);

  if (!hasInfo) {
    return null;
  }

  return (
    <Card className="soft-panel cemetery-preview-card" title="墓地位置">
      {!hasAmapKey() ? (
        <Alert
          type="warning"
          showIcon
          message="未配置高德地图 Key"
          description="当前仅展示墓地文字信息；补充 NEXT_PUBLIC_AMAP_KEY 后可显示地图预览。"
        />
      ) : null}
      {loadError ? <Alert style={{ marginBottom: 12 }} type="error" showIcon message={loadError} /> : null}
      {hasCoordinates && hasAmapKey() ? <div ref={mapContainerRef} className="cemetery-map-preview-canvas" /> : null}
      {!hasCoordinates ? (
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          showIcon
          message="当前仅维护了墓地文字信息"
          description="尚未记录地图坐标，因此这里不会显示地图预览。"
        />
      ) : null}
      <Space
        direction="vertical"
        size={8}
        style={{ width: '100%', marginTop: hasCoordinates && hasAmapKey() ? 12 : 0 }}
      >
        <Space wrap size={[8, 8]}>
          <Tag color={normalizedValue.cemeteryPoiId ? 'processing' : 'default'}>
            {normalizedValue.cemeteryPoiId ? 'POI 选点' : '手动点位'}
          </Tag>
          {hasCoordinates ? (
            <Tag>
              坐标：{normalizedValue.cemeteryLatitude?.toFixed(6)}, {normalizedValue.cemeteryLongitude?.toFixed(6)}
            </Tag>
          ) : null}
        </Space>
        <div>
          <Text strong>墓地名称：</Text>
          <Text>{normalizedValue.cemeteryName ?? '-'}</Text>
        </div>
        <div>
          <Text strong>地址 / POI：</Text>
          <Text>{normalizedValue.cemeteryAddress ?? '-'}</Text>
        </div>
        {normalizedValue.cemeteryRemark ? (
          <Paragraph style={{ marginBottom: 0 }}>
            <Text strong>备注：</Text>
            {normalizedValue.cemeteryRemark}
          </Paragraph>
        ) : null}
        {!normalizedValue.cemeteryRemark && !normalizedValue.cemeteryName && !normalizedValue.cemeteryAddress ? (
          <Text type="secondary">暂无更多墓地说明。</Text>
        ) : null}
      </Space>
    </Card>
  );
}
