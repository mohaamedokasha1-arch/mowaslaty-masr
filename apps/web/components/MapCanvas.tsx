'use client';

import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '@mowaslaty/shared';
import type { MapMarker, MapPath } from './MapView';

function FitBounds({ markers, paths }: { markers: MapMarker[]; paths: MapPath[] }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [
      ...markers.map((m) => [m.lat, m.lng] as [number, number]),
      ...paths.flatMap((p) => p.points.map((pt) => [pt.lat, pt.lng] as [number, number])),
    ];
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [36, 36] });
  }, [map, markers, paths]);
  return null;
}

export default function MapCanvas({
  markers,
  paths,
}: {
  markers: MapMarker[];
  paths: MapPath[];
}) {
  const center: [number, number] = markers.length > 0 ? [markers[0].lat, markers[0].lng] : [30.06, 31.25];

  return (
    <MapContainer center={center} zoom={13} className="map-wrap" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds markers={markers} paths={paths} />
      {paths.map((p, i) => (
        <Polyline
          key={`path-${i}`}
          positions={p.points.map((pt) => [pt.lat, pt.lng] as [number, number])}
          pathOptions={{ color: p.color, weight: 5, opacity: 0.85, dashArray: p.dashed ? '6 8' : undefined }}
        />
      ))}
      {markers.map((m, i) => (
        <CircleMarker
          key={`m-${i}`}
          center={[m.lat, m.lng]}
          radius={m.kind === 'endpoint' ? 9 : 6}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: m.color ?? (m.kind === 'endpoint' ? '#f2a20c' : '#0e7c6b'),
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top">{m.name}</Tooltip>
          <Popup>{m.name}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
