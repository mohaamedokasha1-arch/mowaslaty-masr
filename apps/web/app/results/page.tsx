'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CONFIDENCE_LABELS,
  SEARCH_MODES,
  SEARCH_MODE_LABELS,
  formatDuration,
  type RideLeg,
  type SearchMode,
  type Trip,
  type TripPlanResult,
} from '@mowaslaty/shared';
import { apiGet } from '@/lib/api';
import MapView, { type MapMarker, type MapPath } from '@/components/MapView';
import TripPlanner from '@/components/TripPlanner';

function ConfidenceBadge({ level }: { level: Trip['confidence'] }) {
  return (
    <span className={`badge badge-${level.toLowerCase()}`}>
      {level === 'HIGH' ? '✅' : level === 'MEDIUM' ? '👍' : level === 'LOW' ? '⚠️' : '❔'}{' '}
      {CONFIDENCE_LABELS[level].ar}
    </span>
  );
}

function TripCard({
  trip,
  index,
  active,
  onSelect,
}: {
  trip: Trip;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`trip-card ${active ? 'best' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{ cursor: 'pointer' }}
    >
      <div className="trip-head">
        <div>
          <strong style={{ fontSize: '1.05rem' }}>
            {index === 0 ? '⭐ أفضل خيار' : `خيار ${index + 1}`}
          </strong>{' '}
          <ConfidenceBadge level={trip.confidence} />
        </div>
        <div className="trip-totals">
          <div className="trip-total">
            <div className="value">{formatDuration(trip.totalDurationMin)}</div>
            <div className="label">المدة</div>
          </div>
          <div className="trip-total">
            <div className="value">{trip.totalFare > 0 ? `${trip.totalFare} ج.م` : 'مجانًا'}</div>
            <div className="label">الأجرة</div>
          </div>
          <div className="trip-total">
            <div className="value">{trip.transfers}</div>
            <div className="label">تبديلات</div>
          </div>
          <div className="trip-total">
            <div className="value">
              {trip.walkDistanceKm > 0 ? `${trip.walkDistanceKm.toFixed(1)} كم` : '0 كم'}
            </div>
            <div className="label">مشي</div>
          </div>
        </div>
      </div>

      <div className="legs">
        {trip.legs.map((leg, i) =>
          leg.type === 'WALK' ? (
            <div className="leg walk" key={i}>
              <div className="leg-title">
                🚶 مشي {Math.round(leg.distanceKm * 1000)} متر
                <span className="leg-desc">({formatDuration(leg.durationMin)})</span>
              </div>
              <div className="leg-desc">
                من {leg.fromName} إلى {leg.toName}
              </div>
            </div>
          ) : (
            <RideLegRow key={i} leg={leg} />
          ),
        )}
      </div>
    </div>
  );
}

function RideLegRow({ leg }: { leg: RideLeg }) {
  return (
    <div className="leg">
      <div className="leg-title">
        <span
          className="leg-chip"
          style={{ background: leg.modeColor }}
        >
          {leg.modeIcon} {leg.modeNameAr}
        </span>
        <Link
          href={`/route/${leg.routeId}`}
          onClick={(e) => e.stopPropagation()}
          style={{ textDecoration: 'underline' }}
        >
          {leg.routeNameAr}
        </Link>
        <span className="leg-desc">({formatDuration(leg.durationMin)} · {leg.fare} ج.م)</span>
      </div>
      <div className="leg-desc">
        اركب من <strong>{leg.fromName}</strong> وانزل في <strong>{leg.toName}</strong> بعد{' '}
        {leg.stopsCount} محطات
      </div>
    </div>
  );
}

function ResultsInner() {
  const params = useSearchParams();
  const fromText = params.get('fromText') ?? '';
  const toText = params.get('toText') ?? '';
  const initialMode = (params.get('mode') as SearchMode) || 'FASTEST';

  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [result, setResult] = useState<TripPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(0);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!fromText || !toText) return;
    setLoading(true);
    setError('');
    setSelectedTrip(0);
    apiGet<TripPlanResult>(
      `/api/trips/plan?fromText=${encodeURIComponent(fromText)}&toText=${encodeURIComponent(toText)}&mode=${mode}`,
    )
      .then((res) => setResult(res))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fromText, toText, mode]);

  const mapData = useMemo(() => {
    const trip = result?.trips[selectedTrip];
    if (!trip || !result.resolvedFrom || !result.resolvedTo) return null;
    const markers: MapMarker[] = [
      { lat: result.resolvedFrom.lat, lng: result.resolvedFrom.lng, name: result.resolvedFrom.nameAr, kind: 'endpoint' },
      { lat: result.resolvedTo.lat, lng: result.resolvedTo.lng, name: result.resolvedTo.nameAr, kind: 'endpoint' },
    ];
    const paths: MapPath[] = [];
    for (const leg of trip.legs) {
      paths.push({
        points: [leg.from, leg.to],
        color: leg.type === 'WALK' ? '#5c6b75' : leg.modeColor,
        dashed: leg.type === 'WALK',
      });
      if (leg.type === 'RIDE') {
        markers.push({ lat: leg.from.lat, lng: leg.from.lng, name: leg.fromName, color: leg.modeColor, kind: 'stop' });
        markers.push({ lat: leg.to.lat, lng: leg.to.lng, name: leg.toName, color: leg.modeColor, kind: 'stop' });
      }
    }
    return { markers, paths };
  }, [result, selectedTrip]);

  if (!fromText || !toText) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="notice notice-warn">اكتب نقطة البداية والوجهة أولًا:</div>
        <TripPlanner compact />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1>نتائج الرحلة</h1>
        <p>
          من <strong>{result?.resolvedFrom?.nameAr ?? fromText}</strong> إلى{' '}
          <strong>{result?.resolvedTo?.nameAr ?? toText}</strong>
        </p>
      </div>

      <div className="mode-picker" role="tablist" aria-label="طريقة المفاضلة">
        {SEARCH_MODES.map((m) => (
          <Link
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`mode-chip ${mode === m ? 'active' : ''}`}
            href={`/results?fromText=${encodeURIComponent(fromText)}&toText=${encodeURIComponent(toText)}&mode=${m}`}
          >
            {SEARCH_MODE_LABELS[m].icon} {SEARCH_MODE_LABELS[m].ar}
          </Link>
        ))}
      </div>

      {loading && (
        <div className="loading-block">
          <div className="spinner" />
          <span>جارٍ البحث عن أفضل الرحلات…</span>
        </div>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      {!loading && !error && result && !result.ok && (
        <div className="notice notice-error">
          <p>{result.messageAr ?? result.message}</p>
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="suggestions">
              {result.suggestions.map((s) => (
                <Link
                  key={s}
                  href={`/results?fromText=${encodeURIComponent(s)}&toText=${encodeURIComponent(toText)}&mode=${mode}`}
                >
                  {s}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && result?.ok && result.trips.length > 0 && (
        <>
          <div style={{ margin: '14px 0' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowMap((v) => !v)}>
              {showMap ? '🙈 إخفاء الخريطة' : '🗺️ إظهار الخريطة'}
            </button>
          </div>

          {showMap && mapData && (
            <div style={{ marginBottom: 18 }}>
              <MapView markers={mapData.markers} paths={mapData.paths} height={380} />
            </div>
          )}

          {result.trips.map((trip, i) => (
            <TripCard
              key={trip.id}
              trip={trip}
              index={i}
              active={selectedTrip === i}
              onSelect={() => setSelectedTrip(i)}
            />
          ))}

          <div className="notice notice-info" style={{ marginTop: 20 }}>
            💡 الأسعار والأوقات تقديرية وقد تختلف على أرض الواقع. لو لاحظت اختلافًا،{' '}
            <Link href="/report" style={{ textDecoration: 'underline' }}>
              أرسل بلاغًا
            </Link>{' '}
            وسيراجعه فريقنا.
          </div>
        </>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-block">
          <div className="spinner" />
          <span>جارٍ التحميل…</span>
        </div>
      }
    >
      <ResultsInner />
    </Suspense>
  );
}
