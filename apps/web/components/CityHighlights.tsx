'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CityDto, ListResponse } from '@mowaslaty/shared';
import { apiGet } from '@/lib/api';

export default function CityHighlights() {
  const [cities, setCities] = useState<CityDto[] | null>(null);

  useEffect(() => {
    apiGet<ListResponse<CityDto>>('/api/cities?take=12')
      .then((res) => setCities(res.data))
      .catch(() => setCities([]));
  }, []);

  return (
    <>
      <h2>المدن المتاحة</h2>
      <p className="section-sub">نغطي هذه المدن حاليًا — والمزيد قادم قريبًا</p>
      {cities === null ? (
        <div className="loading-block">
          <div className="spinner" />
          <span>جارٍ التحميل…</span>
        </div>
      ) : (
        <div className="grid-3">
          {cities.map((c) => (
            <Link key={c.id} href={`/routes?cityId=${c.id}`} className="card" style={{ display: 'block' }}>
              <h3 style={{ marginBottom: 4 }}>🏙️ {c.nameAr}</h3>
              <p style={{ color: 'var(--ink-soft)', fontSize: '0.88rem' }}>{c.description}</p>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-info">{c._count?.routes ?? 0} خط</span>
                <span className="badge badge-info">{c._count?.stops ?? 0} محطة</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
