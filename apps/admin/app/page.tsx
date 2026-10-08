'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import AdminShell from '@/components/AdminShell';

interface DashboardResponse {
  stats: {
    routes: number;
    activeRoutes: number;
    stops: number;
    verifiedStops: number;
    cities: number;
    reports: number;
    pendingReports: number;
    dataUpdates: number;
    searches: number;
  };
  recentUpdates: Array<{
    id: string;
    changeType: string;
    description: string;
    createdAt: string;
    route?: { nameAr: string } | null;
  }>;
  dataSources: Array<{ id: string; name: string; sourceType: string; description?: string | null }>;
}

const CHANGE_BADGES: Record<string, { label: string; cls: string }> = {
  FARE_CHANGED: { label: 'تغيير أجرة', cls: 'badge-amber' },
  HOURS_CHANGED: { label: 'تغيير مواعيد', cls: 'badge-teal' },
  STOPS_CHANGED: { label: 'تغيير محطات', cls: 'badge-teal' },
  ROUTE_CREATED: { label: 'خط جديد', cls: 'badge-green' },
  ROUTE_DELETED: { label: 'حذف خط', cls: 'badge-red' },
  ROUTE_MODIFIED: { label: 'تعديل خط', cls: 'badge-teal' },
  STATUS_CHANGED: { label: 'تغيير حالة', cls: 'badge-gray' },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<DashboardResponse>('/api/admin/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AdminShell>
      <h1>📊 نظرة عامة</h1>
      <p className="sub">ملخص حالة بيانات المنصة وآخر التغييرات</p>

      {error && <div className="notice notice-error">{error}</div>}
      {!data && !error && (
        <div className="loading-block">
          <div className="spinner" />
        </div>
      )}

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="value">{data.stats.routes}</div>
              <div className="label">خط ({data.stats.activeRoutes} نشط)</div>
            </div>
            <div className="stat-card">
              <div className="value">{data.stats.stops}</div>
              <div className="label">محطة ({data.stats.verifiedStops} مُتحقق منها)</div>
            </div>
            <div className="stat-card">
              <div className="value">{data.stats.cities}</div>
              <div className="label">مدينة</div>
            </div>
            <div className="stat-card">
              <div className="value" style={{ color: data.stats.pendingReports > 0 ? 'var(--danger)' : undefined }}>
                {data.stats.pendingReports}
              </div>
              <div className="label">بلاغ قيد الانتظار (من {data.stats.reports})</div>
            </div>
          </div>

          <div className="card">
            <h2>🕘 آخر التحديثات على البيانات</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>الوصف</th>
                  <th>الخط</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {data.recentUpdates.map((u) => {
                  const badge = CHANGE_BADGES[u.changeType] ?? { label: u.changeType, cls: 'badge-gray' };
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td>{u.description}</td>
                      <td>{u.route?.nameAr ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(u.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>🗂️ مصادر البيانات</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>المصدر</th>
                  <th>النوع</th>
                  <th>الوصف</th>
                </tr>
              </thead>
              <tbody>
                {data.dataSources.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.name}</td>
                    <td>
                      <span className="badge badge-teal">{s.sourceType}</span>
                    </td>
                    <td>{s.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
