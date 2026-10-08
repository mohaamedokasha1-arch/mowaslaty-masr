'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportDto, type RouteDto } from '@mowaslaty/shared';
import { apiGet, apiPost } from '@/lib/api';

function ReportInner() {
  const params = useSearchParams();
  const presetRouteId = params.get('routeId') ?? '';

  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [reportType, setReportType] = useState<string>('FARE_INCORRECT');
  const [routeId, setRouteId] = useState(presetRouteId);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<ReportDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<{ data: RouteDto[] }>('/api/routes?take=100')
      .then((res) => setRoutes(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (presetRouteId) setRouteId(presetRouteId);
  }, [presetRouteId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const report = await apiPost<ReportDto>('/api/reports', {
        reportType,
        routeId: routeId || undefined,
        description,
      });
      setDone(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال البلاغ');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="container" style={{ paddingTop: 40, maxWidth: 640 }}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '3rem' }}>💚</div>
          <h2 style={{ margin: '10px 0' }}>شكرًا! تم استلام بلاغك</h2>
          <p style={{ color: 'var(--ink-soft)' }}>
            رقم البلاغ: <code>{done.id}</code>
            <br />
            سيراجعه فريق البيانات وسينعكس أي تصحيح على معلومات الخط قريبًا.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 30, maxWidth: 640 }}>
      <div className="page-head">
        <h1>🚩 إرسال بلاغ</h1>
        <p>
          لاحظت أجرة خاطئة، خطًا متوقفًا، أو محطة في غير مكانها؟ بلاغك يحسّن البيانات للجميع —
          يمكنك الإبلاغ بدون تسجيل حساب.
        </p>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>نوع البلاغ</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {REPORT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>الخط المعني (اختياري)</label>
          <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">— بدون تحديد خط —</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.transportMode?.icon} {r.nameAr} ({r.city?.nameAr})
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>التفاصيل (10 أحرف على الأقل)</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: الأجرة الفعلية من المحطة إلى الجامعة 6 جنيهات وليس 5…"
            required
            minLength={10}
          />
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'جارٍ الإرسال…' : '📨 إرسال البلاغ'}
        </button>
      </form>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-block">
          <div className="spinner" />
        </div>
      }
    >
      <ReportInner />
    </Suspense>
  );
}
