'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StopDto } from '@mowaslaty/shared';
import { apiGet, apiPatch } from '@/lib/api';
import AdminShell from '@/components/AdminShell';

export default function AdminStopsPage() {
  const [stops, setStops] = useState<StopDto[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const qs = search ? `?searchQuery=${encodeURIComponent(search)}` : '';
    apiGet<{ data: StopDto[] }>(`/api/admin/stops${qs}`)
      .then((res) => setStops(res.data))
      .catch((e) => setError(e.message));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const toggleVerify = async (stop: StopDto) => {
    setError('');
    try {
      await apiPatch(`/api/admin/stops/${stop.id}`, { verified: !stop.verified });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    }
  };

  return (
    <AdminShell>
      <h1>🚏 إدارة المحطات</h1>
      <p className="sub">راجع المحطات ووثّقها بعد التأكد من موقعها واسمها</p>

      <div className="card">
        <div className="field" style={{ maxWidth: 360 }}>
          <label>بحث</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المحطة…"
          />
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        <table className="data">
          <thead>
            <tr>
              <th>المحطة</th>
              <th>المدينة</th>
              <th>النوع</th>
              <th>الإحداثيات</th>
              <th>الحالة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 700 }}>{s.nameAr}</td>
                <td>{s.city?.nameAr ?? s.cityId}</td>
                <td>{s.type}</td>
                <td dir="ltr" style={{ fontSize: '0.8rem' }}>
                  {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                </td>
                <td>
                  {s.verified ? (
                    <span className="badge badge-green">موثّقة ✅</span>
                  ) : (
                    <span className="badge badge-amber">بحاجة لمراجعة</span>
                  )}
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${s.verified ? 'btn-ghost' : 'btn-brand'}`}
                    onClick={() => toggleVerify(s)}
                  >
                    {s.verified ? 'إلغاء التوثيق' : 'توثيق'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
