'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CONFIDENCE_LEVELS,
  CONFIDENCE_LABELS,
  ROUTE_STATUSES,
  ROUTE_STATUS_LABELS,
  type ConfidenceLevel,
  type RouteDto,
  type RouteStatus,
} from '@mowaslaty/shared';
import { apiGet, apiPatch } from '@/lib/api';
import AdminShell from '@/components/AdminShell';

const STATUS_BADGE: Record<RouteStatus, string> = {
  ACTIVE: 'badge-green',
  INACTIVE: 'badge-gray',
  SUSPENDED: 'badge-red',
  UNDER_REVIEW: 'badge-amber',
  DRAFT: 'badge-gray',
};

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [fare, setFare] = useState('');
  const [hours, setHours] = useState('');

  const load = useCallback(() => {
    apiGet<{ data: RouteDto[] }>('/api/admin/routes?status=ALL')
      .then((res) => setRoutes(res.data))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const startEdit = (r: RouteDto) => {
    setEditing(r.id);
    setFare(r.fare != null ? String(r.fare) : '');
    setHours(r.operatingHours ?? '');
  };

  const saveEdit = async (id: string) => {
    setError('');
    try {
      const patch: Record<string, unknown> = {};
      const fareNum = fare === '' ? null : Number(fare);
      if (fareNum !== null && Number.isNaN(fareNum)) {
        throw new Error('الأجرة يجب أن تكون رقمًا');
      }
      patch.fare = fareNum;
      patch.operatingHours = hours || null;
      await apiPatch(`/api/admin/routes/${id}`, patch);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    }
  };

  const setStatus = async (id: string, status: RouteStatus) => {
    setError('');
    try {
      await apiPatch(`/api/admin/routes/${id}`, { status });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    }
  };

  const setConfidence = async (id: string, confidenceLevel: ConfidenceLevel) => {
    setError('');
    try {
      await apiPatch(`/api/admin/routes/${id}`, { confidenceLevel });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    }
  };

  return (
    <AdminShell>
      <h1>🚌 إدارة الخطوط</h1>
      <p className="sub">عدّل الأجرة والمواعيد والحالة ودرجة الموثوقية — كل تغيير يُسجل في سجل التحديثات</p>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="card">
        {routes.length === 0 ? (
          <div className="loading-block">
            <div className="spinner" />
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>الخط</th>
                <th>الوسيلة</th>
                <th>الأجرة (ج.م)</th>
                <th>المواعيد</th>
                <th>الحالة</th>
                <th>الموثوقية</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, maxWidth: 260 }}>
                    {r.nameAr}
                    <div style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                      {r.city?.nameAr}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.transportMode?.icon} {r.transportMode?.nameAr}
                  </td>
                  <td>
                    {editing === r.id ? (
                      <input
                        style={{ width: 80 }}
                        value={fare}
                        onChange={(e) => setFare(e.target.value)}
                        placeholder="—"
                      />
                    ) : r.fare != null ? (
                      <strong>{r.fare}</strong>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {editing === r.id ? (
                      <input
                        style={{ width: 120 }}
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        placeholder="06:00-23:00"
                        dir="ltr"
                      />
                    ) : (
                      <span dir="ltr">{r.operatingHours ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    <select
                      className="badge"
                      style={{ border: 'none', background: 'transparent' }}
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value as RouteStatus)}
                    >
                      {ROUTE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ROUTE_STATUS_LABELS[s].ar}
                        </option>
                      ))}
                    </select>
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>
                      {ROUTE_STATUS_LABELS[r.status].ar}
                    </span>
                  </td>
                  <td>
                    <select
                      value={r.confidenceLevel}
                      style={{ fontSize: '0.8rem', padding: 4 }}
                      onChange={(e) => setConfidence(r.id, e.target.value as ConfidenceLevel)}
                    >
                      {CONFIDENCE_LEVELS.map((c) => (
                        <option key={c} value={c}>
                          {CONFIDENCE_LABELS[c].ar}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editing === r.id ? (
                      <>
                        <button className="btn btn-brand btn-sm" onClick={() => saveEdit(r.id)}>
                          حفظ
                        </button>{' '}
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>
                        تعديل
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
