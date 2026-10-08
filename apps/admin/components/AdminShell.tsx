'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getToken, getUser } from '@/lib/api';

const NAV = [
  { href: '/', label: 'نظرة عامة', icon: '📊' },
  { href: '/reports', label: 'البلاغات', icon: '🚩' },
  { href: '/routes', label: 'الخطوط', icon: '🚌' },
  { href: '/stops', label: 'المحطات', icon: '🚏' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="loading-block">
        <div className="spinner" />
        <span>جارٍ التحقق من الجلسة…</span>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="logo">🚌 مواصلاتي مصر — الإدارة</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
          >
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
        <div className="spacer" />
        <div className="user-box">
          <div style={{ fontWeight: 700 }}>{user?.name ?? user?.email}</div>
          <div style={{ opacity: 0.7 }}>{user?.role}</div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 8, color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
