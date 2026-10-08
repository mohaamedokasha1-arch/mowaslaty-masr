'use client';

import { useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';

export interface PlaceOption {
  id: string;
  nameAr: string;
  sub?: string;
  lat?: number;
  lng?: number;
}

interface SearchResponse {
  query: string;
  results: {
    routes?: Array<{ id: string; nameAr: string; city?: string }>;
    stops?: Array<{ id: string; nameAr: string; city?: string; latitude: number; longitude: number }>;
    cities?: Array<{ id: string; nameAr: string }>;
  };
}

/**
 * Autocomplete box for origin/destination. Resolves against stops, areas and
 * cities via /api/search and falls back to free text (the backend geocoder
 * will resolve it at planning time).
 */
export default function PlaceSearchBox({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 1) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const data = await apiGet<SearchResponse>(
          `/api/search?query=${encodeURIComponent(q)}&limit=6`,
        );
        const opts: PlaceOption[] = [];
        for (const s of data.results.stops ?? []) {
          opts.push({ id: `stop-${s.id}`, nameAr: s.nameAr, sub: s.city ? `محطة · ${s.city}` : 'محطة', lat: s.latitude, lng: s.longitude });
        }
        for (const c of data.results.cities ?? []) {
          opts.push({ id: `city-${c.id}`, nameAr: c.nameAr, sub: 'مدينة' });
        }
        for (const r of data.results.routes ?? []) {
          opts.push({ id: `route-${r.id}`, nameAr: r.nameAr, sub: r.city ? `خط · ${r.city}` : 'خط' });
        }
        setOptions(opts.slice(0, 8));
        setOpen(opts.length > 0);
      } catch {
        setOptions([]);
      }
    }, 250);
  };

  return (
    <div className="field autocomplete" ref={wrapperRef}>
      <label>{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => options.length > 0 && setOpen(true)}
        aria-label={label}
      />
      {open && (
        <div className="autocomplete-list" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.nameAr);
                setOpen(false);
              }}
            >
              <span style={{ flex: 1 }}>{opt.nameAr}</span>
              {opt.sub && <span className="kind">{opt.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
