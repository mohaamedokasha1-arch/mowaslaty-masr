'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CityDto, ListResponse } from '@mowaslaty/shared';
import { apiGet } from '@/lib/api';

export default function CitiesPage() {
  const [cities, setCities] = useState<CityDto[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<ListResponse<CityDto>>('/api/cities?take=50')
      .then((res) => setCities(res.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="container">
      <div className="page-head">
        <h1>🏙️ المدن المتاحة</h1>
        <p>المدن التي نغطيها حاليًا — نضيف مدنًا جديدة باستمرار بدعم من المجتمع</p>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {!cities && !error && (
        <div className="loading-block">
          <div className="spinner" />
          <span>جارٍ التحميل…</span>
        </div>
      )}

      <div className="grid-3">
        {cities?.map((c) => (
          <div key={c.id} className="card">
            <h3 style={{ marginBottom: 4 }}>
              {c.nameAr} <small style={{ color: 'var(--ink-soft)' }}>({c.name})</small>
            </h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>{c.description}</p>
            <div style={{ margin: '12px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-info">🚏 {c._count?.routes ?? 0} خط</span>
              <span className="badge badge-info">📍 {c._count?.stops ?? 0} محطة</span>
              <span className="badge badge-info">🗺️ {c._count?.areas ?? 0} منطقة</span>
            </div>
            <Link href={`/routes?cityId=${c.id}`} className="btn btn-brand btn-sm">
              استعرض خطوط {c.nameAr}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
