'use client';

import { useState } from 'react';
import { DATA_SOURCE_TYPES, type ImportSummary } from '@mowaslaty/shared';
import { apiPost } from '@/lib/api';
import AdminShell from '@/components/AdminShell';

export default function ImportPage() {
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState('GTFS');
  const [sourceUrl, setSourceUrl] = useState('');
  const [files, setFiles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    const next: Record<string, string> = { ...files };
    for (const f of Array.from(list)) {
      if (!f.name.toLowerCase().endsWith('.txt')) continue;
      next[f.name.toLowerCase()] = await f.text();
    }
    setFiles(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const res = await apiPost<ImportSummary>('/api/admin/import/gtfs', {
        sourceName,
        sourceType,
        sourceUrl: sourceUrl || undefined,
        files,
      });
      setSummary(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الاستيراد');
    } finally {
      setBusy(false);
    }
  };

  const required = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'];

  return (
    <AdminShell>
      <h1>📥 استيراد بيانات (GTFS)</h1>
      <p className="sub">
        أضف بيانات حقيقية من أي هيئة نقل بصيغة GTFS — الاستيراد تكراري (idempotent): المطابقة
        بالمعرف الخارجي ثم باسم المحطة، فلا تتكرر البيانات عند إعادة التشغيل
      </p>

      <div className="card">
        <h2>خطوات سريعة</h2>
        <ol style={{ paddingRight: 20, color: 'var(--ink-soft)', fontSize: '0.92rem' }}>
          <li>
            حمّل ملف الـ feed (صيغة <code>.zip</code>) من مصدر البيانات ثم فك ضغطه:{' '}
            <code dir="ltr">unzip feed.zip -d feed/</code>
          </li>
          <li>اختر ملفات <code>.txt</code> هنا (المطلوبة: {required.join('، ')})</li>
          <li>حدد اسم المصدر واضغط استيراد — ستظهر المحطات والخطوط فورًا في المنصة</li>
        </ol>
        <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
          أو عبر سطر الأوامر: <code dir="ltr">npm run import:gtfs -- --dir ./feed --source &quot;Cairo GTFS&quot;</code>
        </p>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="field">
          <label>اسم مصدر البيانات *</label>
          <input
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="مثال: GTFS هيئة النقل بالقاهرة"
            required
            minLength={2}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label>نوع المصدر</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {DATA_SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>رابط المصدر (اختياري)</label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              dir="ltr"
            />
          </div>
        </div>

        <div className="field">
          <label>ملفات GTFS (.txt)</label>
          <input type="file" multiple accept=".txt" onChange={(e) => onFiles(e.target.files)} />
        </div>

        {Object.keys(files).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {Object.keys(files).map((name) => (
              <span
                key={name}
                className={`badge ${required.includes(name) ? 'badge-green' : 'badge-gray'}`}
                dir="ltr"
              >
                {required.includes(name) ? '✓ ' : ''}
                {name}
              </span>
            ))}
          </div>
        )}

        {error && <div className="notice notice-error">{error}</div>}

        <button
          className="btn btn-brand"
          disabled={busy || !sourceName || required.some((r) => !files[r])}
        >
          {busy ? 'جارٍ الاستيراد…' : '📥 استيراد الآن'}
        </button>
        {required.some((r) => !files[r]) && (
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 8 }}>
            الملفات المطلوبة: {required.filter((r) => !files[r]).join('، ')}
          </p>
        )}
      </form>

      {summary && (
        <div className="card">
          <h2>نتيجة الاستيراد — {summary.sourceName}</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="badge badge-green">محطات جديدة: {summary.stopsCreated}</span>
            <span className="badge badge-teal">محطات مربوطة بمحطات موجودة: {summary.stopsLinked}</span>
            <span className="badge badge-green">خطوط جديدة: {summary.routesCreated}</span>
            <span className="badge badge-teal">خطوط محدّثة: {summary.routesUpdated}</span>
            {summary.skippedRoutes > 0 && (
              <span className="badge badge-red">خطوط متجاوزة: {summary.skippedRoutes}</span>
            )}
          </div>
          {summary.warnings.length > 0 && (
            <>
              <h2 style={{ fontSize: '0.95rem' }}>تحذيرات</h2>
              <ul style={{ paddingRight: 20, color: 'var(--ink-soft)', fontSize: '0.88rem' }}>
                {summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </>
          )}
          <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
            ظهرت البيانات بالفعل في المنصة — راجعها من صفحة الخطوط ووثّق المحطات الجديدة عند
            التأكد منها.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
