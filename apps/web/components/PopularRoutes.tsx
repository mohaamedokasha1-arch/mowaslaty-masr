'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ListResponse, RouteDto } from '@mowaslaty/shared';
import { apiGet } from '@/lib/api';

export default function PopularRoutes() {
  const [routes, setRoutes] = useState<RouteDto[] | null>(null);

  useEffect(() => {
    apiGet<ListResponse<RouteDto>>('/api/routes?take=6')
      .then((res) => setRoutes(res.data))
      .catch(() => setRoutes([]));
  }, []);

  return (
    <>
      <h2>أشهر الخطوط</h2>
      <p className="section-sub">خطوط نشطة يستخدمها الركاب يوميًا</p>
      {routes === null ? (
        <div className="loading-block">
          <div className="spinner" />
          <span>جارٍ تحميل الخطوط…</span>
        </div>
      ) : routes.length === 0 ? (
        <div className="notice notice-error">تعذر تحميل الخطوط، حاول مجددًا لاحقًا.</div>
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
                  </div>
                </div>
              </div>
              <div className="route-side">
                <span className="fare-tag">{r.fare != null ? `${r.fare} ج.م` : '—'}</span>
              </div>
            </Link>
          ))}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Link href="/routes" className="btn btn-ghost">
              تصفح كل الخطوط ←
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
