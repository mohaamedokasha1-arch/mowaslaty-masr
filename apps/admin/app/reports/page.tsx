'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  type ReportDto,
  type ReportStatus,
} from '@mowaslaty/shared';
import { apiGet, apiPatch } from '@/lib/api';
import AdminShell from '@/components/AdminShell';

const STATUS_BADGE: Record<ReportStatus, string> = {
  PENDING: 'badge-amber',
  REVIEWING: 'badge-teal',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
  RESOLVED: 'badge-green',
};

export default function ReportsPage() {
  const [status, setStatus] = useState<'PENDING' | ReportStatus>('PENDING');
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<{ data: ReportDto[]; pending: number }>(`/api/admin/reports?status=${status}`)
      .then((res) => {
        setReports(res.data);
        setPending(res.pending);
      })
      .catch((e) => setError(e.message));
  }, [status]);

  useEffect(load, [load]);

  const act = async (id: string, next: ReportStatus) => {
    setBusy(id + next);
    setError('');
    try {
      await apiPatch(`/api/admin/reports/${id}`, { status: next });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell>
      <h1>🚩 مراجعة البلاغات</h1>
      <p className="sub">
        {pending} بلاغ في قائمة الانتظار — راجع البلاغات واعتمد التعديلات الصحيحة
      </p>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {REPORT_STATUSES.map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${status === s ? 'btn-brand' : 'btn-ghost'}`}
              onClick={() => setStatus(s)}
            >
              {REPORT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        {reports.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)' }}>لا توجد بلاغات بهذه الحالة ✅</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>النوع</th>
                <th>الوصف</th>
                <th>الخط / المحطة</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{REPORT_TYPE_LABELS[r.reportType]}</td>
                  <td style={{ maxWidth: 340 }}>{r.description}</td>
                  <td>
                    {r.route ? `🚌 ${r.route.nameAr}` : r.stop ? `🚏 ${r.stop.nameAr}` : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>
                      {REPORT_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.status !== 'APPROVED' && r.status !== 'RESOLVED' && (
                      <button
                        className="btn btn-brand btn-sm"
                        disabled={busy === r.id + 'APPROVED'}
                        onClick={() => act(r.id, 'APPROVED')}
                      >
                        قبول
                      </button>
                    )}{' '}
                    {r.status !== 'REJECTED' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy === r.id + 'REJECTED'}
                        onClick={() => act(r.id, 'REJECTED')}
                      >
                        رفض
                      </button>
                    )}{' '}
                    {r.status === 'APPROVED' && (
                      <button
                        className="btn btn-accent btn-sm"
                        disabled={busy === r.id + 'RESOLVED'}
                        onClick={() => act(r.id, 'RESOLVED')}
                      >
                        تم الحل
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
