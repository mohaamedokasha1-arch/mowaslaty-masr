'use client';

import dynamic from 'next/dynamic';
import type { GeoPoint } from '@mowaslaty/shared';

export interface MapMarker {
  lat: number;
  lng: number;
  name: string;
  color?: string;
  kind?: 'stop' | 'endpoint';
}

export interface MapPath {
  points: GeoPoint[];
  color: string;
  dashed?: boolean;
}

/**
 * Interactive Leaflet map (client-only). Uses circle markers so no image
 * assets are required.
 */
const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="loading-block">
      <div className="spinner" />
      <span>جارٍ تحميل الخريطة…</span>
    </div>
  ),
});

export default function MapView({
  markers,
  paths,
  height = 420,
}: {
  markers: MapMarker[];
  paths?: MapPath[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <MapCanvas markers={markers} paths={paths ?? []} />
    </div>
  );
}
