'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CityDto, ListResponse, RouteDto, TransportModeDto } from '@mowaslaty/shared';
import { CONFIDENCE_LABELS } from '@mowaslaty/shared';
import { apiGet } from '@/lib/api';

function RoutesInner() {
  const params = useSearchParams();
  const cityId = params.get('cityId') ?? '';
  const modeName = params.get('mode') ?? '';

  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [cities, setCities] = useState<CityDto[]>([]);
  const [modes, setModes] = useState<TransportModeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiGet<ListResponse<CityDto>>('/api/cities?take=50'), apiGet<{ data: TransportModeDto[] }>('/api/modes')])
      .then(([c, m]) => {
        setCities(c.data);
        setModes(m.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    qs.set('take', '100');
    if (cityId) qs.set('cityId', cityId);
    if (modeName) qs.set('transportMode', modeName);
    apiGet<ListResponse<RouteDto>>(`/api/routes?${qs.toString()}`)
      .then((res) => setRoutes(res.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cityId, modeName]);

  const hrefFor = useMemo(
    () => (next: { cityId?: string; mode?: string }) => {
      const qs = new URLSearchParams();
      const c = next.cityId ?? cityId;
      const m = next.mode ?? modeName;
      if (c) qs.set('cityId', c);
      if (m) qs.set('mode', m);
      const s = qs.toString();
      return `/routes${s ? `?${s}` : ''}`;
    },
    [cityId, modeName],
  );

  return (
    <div className="container">
      <div className="page-head">
        <h1>🚏 كل الخطوط</h1>
        <p>تصفح خطوط المواصلات المتاحة حسب المدينة ووسيلة النقل</p>
      </div>

      <div className="filter-bar">
        <select value={cityId} onChange={(e) => (window.location.href = hrefFor({ cityId: e.target.value }))}>
          <option value="">كل المدن</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
        <select value={modeName} onChange={(e) => (window.location.href = hrefFor({ mode: e.target.value }))}>
          <option value="">كل الوسائل</option>
          {modes.map((m) => (
            <option key={m.id} value={m.nameAr}>
              {m.icon} {m.nameAr}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-block">
          <div className="spinner" />
          <span>جارٍ تحميل الخطوط…</span>
        </div>
      ) : error ? (
        <div className="notice notice-error">{error}</div>
      ) : routes.length === 0 ? (
        <div className="empty-state">
          <div className="big">🕳️</div>
          <p>لا توجد خطوط مطابقة للفلاتر المختارة</p>
        </div>
      ) : (
        <div>
          {routes.map((r) => (
            <Link key={r.id} href={`/route/${r.id}`} className="route-card">
              <div className="route-main">
                <div className="mode-icon" style={{ background: `${r.transportMode?.color}22` }}>
                  {r.transportMode?.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3>{r.nameAr}</h3>
                  <div className="route-meta">
                    <span>🏙️ {r.city?.nameAr}</span>
                    <span>🚏 {r.stops?.length ?? 0} محطات</span>
                    {r.operatingHours && <span>🕐 {r.operatingHours}</span>}
                    <span className={`badge badge-${r.confidenceLevel.toLowerCase()}`}>
                      {CONFIDENCE_LABELS[r.confidenceLevel].ar}
                    </span>
                  </div>
                </div>
              </div>
              <div className="route-side">
                <span className="fare-tag">{r.fare != null ? `${r.fare} ج.م` : 'أجرة غير محددة'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RoutesPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-block">
          <div className="spinner" />
        </div>
      }
    >
      <RoutesInner />
    </Suspense>
  );
}
