'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SEARCH_MODES, SEARCH_MODE_LABELS, type SearchMode } from '@mowaslaty/shared';
import PlaceSearchBox from './PlaceSearchBox';

export default function TripPlanner({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<SearchMode>('FASTEST');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from.trim() || !to.trim()) {
      setError('من فضلك أدخل نقطة البداية والوجهة');
      return;
    }
    setError('');
    const params = new URLSearchParams({
      fromText: from.trim(),
      toText: to.trim(),
      mode,
    });
    router.push(`/results?${params.toString()}`);
  };

  return (
    <form className="planner-card" onSubmit={submit}>
      <div className="planner-grid">
        <PlaceSearchBox
          label="من أين؟"
          placeholder="مثال: ميدان التحرير، جامعة الزقازيق…"
          value={from}
          onChange={setFrom}
        />
        <PlaceSearchBox
          label="إلى أين؟"
          placeholder="مثال: الموقف العمومي، الإسماعيلية…"
          value={to}
          onChange={setTo}
        />
        <button className="btn btn-primary" type="submit" style={{ marginBottom: 1 }}>
          🔍 ابحث عن رحلة
        </button>
      </div>

      {!compact && (
        <div className="mode-picker" role="radiogroup" aria-label="طريقة المفاضلة">
          {SEARCH_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`mode-chip ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
              role="radio"
              aria-checked={mode === m}
            >
              {SEARCH_MODE_LABELS[m].icon} {SEARCH_MODE_LABELS[m].ar}
            </button>
          ))}
        </div>
      )}

      {error && <div className="notice notice-error" style={{ marginTop: 12 }}>{error}</div>}
    </form>
  );
}
