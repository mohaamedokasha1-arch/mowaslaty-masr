'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CONFIDENCE_LABELS, ROUTE_STATUS_LABELS, type RouteDto } from '@mowaslaty/shared';
import { apiGet } from '@/lib/api';
import MapView, { type MapMarker, type MapPath } from '@/components/MapView';

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [route, setRoute] = useState<RouteDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<RouteDto>(`/api/routes/${id}`)
      .then(setRoute)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="notice notice-error">{error}</div>
        <Link href="/routes" className="btn btn-ghost">
          العودة لكل الخطوط
        </Link>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="loading-block">
        <div className="spinner" />
        <span>جارٍ تحميل تفاصيل الخط…</span>
      </div>
    );
  }

  const stops = [...(route.stops ?? [])].sort((a, b) => a.order - b.order);
  const markers: MapMarker[] = stops
    .filter((rs) => rs.stop)
    .map((rs) => ({
      lat: rs.stop!.latitude,
      lng: rs.stop!.longitude,
      name: rs.stop!.nameAr,
      color: route.transportMode?.color,
      kind: 'stop' as const,
    }));
  const paths: MapPath[] = [
    {
      points: markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      color: route.transportMode?.color ?? '#0e7c6b',
    },
  ];

  return (
    <div className="container">
      <div className="page-head">
        <p>
          <Link href="/routes">الخطوط</Link> / {route.city?.nameAr}
        </p>
        <h1>
          {route.transportMode?.icon} {route.nameAr}
        </h1>
        <p>{route.description}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span className={`badge badge-${route.confidenceLevel.toLowerCase()}`}>
            {CONFIDENCE_LABELS[route.confidenceLevel].ar}
          </span>
          {route.status !== 'ACTIVE' && (
            <span className="badge badge-danger">{ROUTE_STATUS_LABELS[route.status].ar}</span>
          )}
          {route.lastVerifiedAt && (
            <span className="badge badge-info">
              آخر تحقق: {new Date(route.lastVerifiedAt).toLocaleDateString('ar-EG')}
            </span>
          )}
          {route.dataSource && <span className="badge badge-info">المصدر: {route.dataSource}</span>}
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'stretch', marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>معلومات الخط</h3>
          <table style={{ width: '100%', fontSize: '0.95rem' }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--ink-soft)', padding: '6px 0' }}>وسيلة النقل</td>
                <td style={{ fontWeight: 700 }}>
                  {route.transportMode?.icon} {route.transportMode?.nameAr}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--ink-soft)', padding: '6px 0' }}>الأجرة</td>
                <td style={{ fontWeight: 700 }}>
                  <span className="fare-tag">
                    {route.fare != null ? `${route.fare} ${route.fareCurrency === 'EGP' ? 'ج.م' : route.fareCurrency}` : 'غير محددة'}
                  </span>{' '}
                  {route.fareUpdatedAt && (
                    <small style={{ color: 'var(--ink-soft)' }}>
                      (حُدّثت {new Date(route.fareUpdatedAt).toLocaleDateString('ar-EG')})
                    </small>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--ink-soft)', padding: '6px 0' }}>مواعيد التشغيل</td>
                <td style={{ fontWeight: 700 }}>{route.operatingHours ?? 'غير مسجلة'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--ink-soft)', padding: '6px 0' }}>عدد المحطات</td>
                <td style={{ fontWeight: 700 }}>{stops.length}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/report?routeId=${route.id}`} className="btn btn-danger btn-sm">
              🚩 الإبلاغ عن مشكلة
            </Link>
          </div>
        </div>

        <div className="map-wrap">
          <MapView markers={markers} paths={paths} height={420} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>🚏 محطات الخط بالترتيب</h3>
        <div className="stops-timeline">
          {stops.map((rs, i) => (
            <div className="stop-row" key={rs.id}>
              <div className="stop-dot" />
              <div>
                <div className="stop-name">
                  {i === 0 ? '🟢 ' : i === stops.length - 1 ? '🔴 ' : ''}
                  {rs.stop?.nameAr ?? rs.stopId}
                </div>
                <div className="stop-sub">
                  {rs.stop?.address ?? rs.stop?.city?.nameAr}
                  {rs.stop && !rs.stop.verified && ' · غير مُتحقق منها'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
